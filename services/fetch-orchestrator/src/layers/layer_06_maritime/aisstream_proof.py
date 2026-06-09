"""AISStream Proof Script - WO-MAR-S Fetch Proof

Minimal proof of concept to connect to AISStream WebSocket, capture real AIS messages,
and save raw data to disk.

Usage:
    python services/fetch-orchestrator/src/layers/layer_06_maritime/aisstream_proof.py

Requirements:
    - AISSTREAM_API_KEY environment variable must be set
    - websockets package (pip install websockets)
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# AISStream configuration
AISSTREAM_WS_URL = "wss://stream.aisstream.io/v0/stream"
AISSTREAM_API_KEY_ENV = "AISSTREAM_API_KEY"

# Proof limits
MAX_MESSAGES = 100
MAX_DURATION_SECONDS = 60


def get_api_key() -> str:
    """Read API key from environment variable."""
    api_key = os.environ.get(AISSTREAM_API_KEY_ENV)
    if not api_key:
        raise ValueError(
            f"{AISSTREAM_API_KEY_ENV} environment variable is not set. "
            "Please set it before running this script."
        )
    return api_key


def create_run_directory() -> Path:
    """Create directory for this proof run."""
    now = datetime.now(timezone.utc)
    run_dir = Path("raw/layer_06_maritime/aisstream") / now.strftime("%Y/%m/%d") / f"run_{now.strftime('%Y%m%dT%H%M%SZ')}"
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


async def connect_and_capture(run_dir: Path) -> dict[str, Any]:
    """Connect to AISStream WebSocket and capture messages."""
    import websockets
    
    api_key = get_api_key()
    
    # Track statistics
    stats = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "message_count": 0,
        "unique_mmsi": set(),
        "message_types": {},
        "errors": [],
    }
    
    raw_messages_path = run_dir / "raw_messages.jsonl"
    
    print(f"Connecting to {AISSTREAM_WS_URL}...")
    print(f"Output directory: {run_dir}")
    
    try:
        async with websockets.connect(AISSTREAM_WS_URL) as ws:
            print("Connected! Sending subscription...")
            
            # Send subscription message
            subscription = {
                "APIKey": api_key,
                "BoundingBoxes": [[[-90, -180], [90, 180]]],
                "FilterMessageTypes": ["PositionReport", "ShipStaticData"]
            }
            await ws.send(json.dumps(subscription))
            print("Subscription sent!")
            
            # Capture messages
            start_time = asyncio.get_event_loop().time()
            
            async for message in ws:
                try:
                    # Parse message
                    data = json.loads(message)
                    received_at = datetime.now(timezone.utc).isoformat()
                    
                    # Add received_at timestamp to message
                    wrapped_msg = {
                        "received_at": received_at,
                        **data
                    }
                    
                    # Write to raw file
                    with open(raw_messages_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps(wrapped_msg) + "\n")
                    
                    # Track statistics
                    stats["message_count"] += 1
                    
                    # Extract MMSI from MetaData (camelCase in AISStream)
                    mmsi = data.get("MetaData", {}).get("MMSI")
                    if mmsi:
                        stats["unique_mmsi"].add(mmsi)
                    
                    # Track message types
                    msg_type = data.get("MessageType", "Unknown")
                    stats["message_types"][msg_type] = stats["message_types"].get(msg_type, 0) + 1
                    
                    # Progress output
                    print(f"Message #{stats['message_count']}: {msg_type} (MMSI: {mmsi})")
                    
                    # Check limits
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if stats["message_count"] >= MAX_MESSAGES:
                        print(f"Reached max messages: {MAX_MESSAGES}")
                        break
                    if elapsed >= MAX_DURATION_SECONDS:
                        print(f"Reached max duration: {MAX_DURATION_SECONDS}s")
                        break
                        
                except json.JSONDecodeError as e:
                    stats["errors"].append(f"JSON decode error: {e}")
                    print(f"Error: Failed to parse message: {e}")
                except Exception as e:
                    stats["errors"].append(f"Unexpected error: {e}")
                    print(f"Error: {e}")
                    
    except Exception as e:
        stats["errors"].append(f"Connection error: {e}")
        print(f"Connection error: {e}")
        raise
    
    finally:
        stats["ended_at"] = datetime.now(timezone.utc).isoformat()
        duration = (datetime.fromisoformat(stats["ended_at"]) - datetime.fromisoformat(stats["started_at"])).total_seconds()
        stats["duration_seconds"] = duration
    
    return stats


def save_metadata(run_dir: Path, stats: dict[str, Any]) -> dict[str, Any]:
    """Save metadata.json with run statistics."""
    metadata = {
        "layer_id": "layer_06_maritime",
        "source_id": "aisstream",
        "run_id": run_dir.name,
        "started_at": stats["started_at"],
        "ended_at": stats["ended_at"],
        "duration_seconds": stats.get("duration_seconds", 0),
        "message_count": stats["message_count"],
        "unique_mmsi_count": len(stats["unique_mmsi"]),
        "message_type_counts": stats["message_types"],
        "subscription_bbox_used": "[[[-90, -180], [90, 180]]]",
        "subscription_message_types_used": ["PositionReport", "ShipStaticData"],
        "errors": stats.get("errors", []),
        "status": "success" if stats["message_count"] > 0 else "fail"
    }
    
    metadata_path = run_dir / "metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Metadata saved to: {metadata_path}")
    return metadata


def save_preview(run_dir: Path) -> None:
    """Save preview.json with first 10 messages."""
    raw_messages_path = run_dir / "raw_messages.jsonl"
    preview_path = run_dir / "preview.json"
    
    messages = []
    with open(raw_messages_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= 10:
                break
            msg = json.loads(line)
            # Extract key fields for preview
            preview_msg = {
                "received_at": msg.get("received_at"),
                "message_type": msg.get("MessageType"),
                "mmsi": msg.get("MetaData", {}).get("MMSI"),
                "ship_name": msg.get("MetaData", {}).get("ShipName"),
            }
            
            # Add position fields if available
            if "Message" in msg:
                msg_data = msg["Message"]
                if isinstance(msg_data, dict):
                    # Get the nested message type
                    for key in msg_data:
                        inner = msg_data[key]
                        if isinstance(inner, dict):
                            preview_msg["latitude"] = inner.get("Latitude")
                            preview_msg["longitude"] = inner.get("Longitude")
                            preview_msg["speed"] = inner.get("Sog")
                            preview_msg["course"] = inner.get("Cog")
                            preview_msg["heading"] = inner.get("TrueHeading")
                            break
            
            messages.append(preview_msg)
    
    preview = {
        "source_id": "aisstream",
        "layer_id": "layer_06_maritime",
        "run_id": run_dir.name,
        "preview_count": len(messages),
        "messages": messages
    }
    
    with open(preview_path, "w", encoding="utf-8") as f:
        json.dump(preview, f, indent=2)
    
    print(f"Preview saved to: {preview_path}")


def save_observed_fields(run_dir: Path) -> None:
    """Save observed_fields.json with field analysis."""
    raw_messages_path = run_dir / "raw_messages.jsonl"
    fields_path = run_dir / "observed_fields.json"
    
    message_types = set()
    top_level_fields = set()
    nested_fields: dict[str, set] = {}
    metadata_fields = set()
    
    with open(raw_messages_path, "r", encoding="utf-8") as f:
        for line in f:
            msg = json.loads(line)
            
            # Message type
            if "MessageType" in msg:
                message_types.add(msg["MessageType"])
            
            # Top level fields
            for key in msg:
                if key not in ("Message", "Metadata"):
                    top_level_fields.add(key)
            
            # Metadata fields
            if "MetaData" in msg and isinstance(msg["MetaData"], dict):
                for key in msg["MetaData"]:
                    metadata_fields.add(key)
            
            # Nested message fields
            if "Message" in msg and isinstance(msg["Message"], dict):
                for msg_type, msg_data in msg["Message"].items():
                    if msg_type not in nested_fields:
                        nested_fields[msg_type] = set()
                    if isinstance(msg_data, dict):
                        for key in msg_data:
                            nested_fields[msg_type].add(key)
    
    observed = {
        "message_types_observed": sorted(message_types),
        "top_level_fields": sorted(top_level_fields),
        "nested_fields_by_message_type": {k: sorted(v) for k, v in nested_fields.items()},
        "metadata_fields": sorted(metadata_fields),
        "fields_different_from_expected": [],
        "missing_fields": [],
        "unexpected_fields": []
    }
    
    with open(fields_path, "w", encoding="utf-8") as f:
        json.dump(observed, f, indent=2)
    
    print(f"Observed fields saved to: {fields_path}")
    print(f"Message types: {message_types}")


def main():
    """Main entry point."""
    print("=" * 60)
    print("AISStream Proof Script - WO-MAR-S")
    print("=" * 60)
    
    # Check for API key
    try:
        get_api_key()
        print(f"OK: {AISSTREAM_API_KEY_ENV} is set")
    except ValueError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    
    # Create run directory
    run_dir = create_run_directory()
    print(f"OK: Run directory: {run_dir}")
    
    # Run capture
    try:
        stats = asyncio.run(connect_and_capture(run_dir))
    except Exception as e:
        print(f"ERROR: Capture failed: {e}")
        sys.exit(1)
    
    # Save outputs
    metadata = save_metadata(run_dir, stats)
    save_preview(run_dir)
    save_observed_fields(run_dir)
    
    # Summary
    print("\n" + "=" * 60)
    print("CAPTURE COMPLETE")
    print("=" * 60)
    print(f"Messages captured: {metadata['message_count']}")
    print(f"Unique MMSI: {metadata['unique_mmsi_count']}")
    print(f"Duration: {metadata.get('duration_seconds', 0):.1f}s")
    print(f"Message types: {metadata['message_type_counts']}")
    print(f"Status: {metadata['status']}")
    
    if metadata["errors"]:
        print(f"Errors: {metadata['errors']}")
    
    print(f"\nRaw data: {run_dir / 'raw_messages.jsonl'}")
    print(f"Metadata: {run_dir / 'metadata.json'}")
    print(f"Preview: {run_dir / 'preview.json'}")
    print(f"Fields: {run_dir / 'observed_fields.json'}")


if __name__ == "__main__":
    main()