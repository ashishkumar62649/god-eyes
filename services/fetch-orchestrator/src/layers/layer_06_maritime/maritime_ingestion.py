"""Maritime Ingestion Orchestrator

Orchestrates the full ingestion pipeline: normalize → write to DB.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
import sys

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from layers.layer_06_maritime.maritime_normalizer import (
    normalize_from_cache,
    normalize_position_report,
    normalize_ship_static_data,
    join_vessel,
)
from layers.layer_06_maritime import maritime_db_writer


class MaritimeIngestion:
    """Orchestrates maritime data ingestion from raw messages to database."""

    def __init__(self, database_url: str | None = None, dry_run: bool = False):
        """Initialize ingestion orchestrator.
        
        Args:
            database_url: PostgreSQL connection string. If None, uses env or default.
            dry_run: If True, normalize but don't write to database.
        """
        self.dry_run = dry_run
        self.database_url = database_url
        self.conn = None
        if not dry_run:
            self.conn = maritime_db_writer.connect_db(database_url or maritime_db_writer.DEFAULT_DATABASE_URL)
            maritime_db_writer.ensure_source_exists(self.conn)

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None

    def ingest_from_cache(
        self,
        input_path: Path,
        run_id: str | None = None,
        run_mode: str = "normalize_from_cache",
    ) -> dict[str, Any]:
        """Ingest normalized data from cached raw messages.
        
        Args:
            input_path: Path to run directory or raw_messages.jsonl
            run_id: Optional run ID for fetch_runs table
            run_mode: Run mode string
            
        Returns:
            Ingestion report dictionary.
        """
        # Normalize the raw messages - this creates normalized/ directory with JSONL files
        norm_result = normalize_from_cache(input_path)
        
        if self.dry_run:
            return {
                "dry_run": True,
                "raw_messages_read": norm_result["raw_messages_read"],
                "positions_normalized": norm_result["position_normalized"],
                "static_normalized": norm_result["static_normalized"],
                "joined_vessels": norm_result["joined_vessels"],
                "skipped_invalid": norm_result["skipped_invalid"],
            }
        
        # Read normalized data from the output files
        # normalize_from_cache writes to input_path/normalized/normalized_*.jsonl
        if input_path.is_dir():
            norm_dir = input_path / "normalized"
        else:
            norm_dir = input_path.parent / "normalized"
        
        positions = []
        static_records = []
        
        positions_file = norm_dir / "normalized_positions.jsonl"
        if positions_file.exists():
            with open(positions_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        positions.append(json.loads(line))
        
        static_file = norm_dir / "normalized_static.jsonl"
        if static_file.exists():
            with open(static_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        static_records.append(json.loads(line))
        
        # Initialize stats
        stats = {
            "raw_messages_read": norm_result["raw_messages_read"],
            "positions_normalized": len(positions),
            "static_normalized": len(static_records),
            "vessels_upserted": 0,
            "positions_upserted": 0,
            "history_rows_inserted": 0,
            "raw_refs_inserted": 0,
            "skipped_invalid": norm_result["skipped_invalid"],
            "errors": [],
        }
        
        # Determine run_id from path if not provided
        if run_id is None:
            if input_path.is_dir():
                run_id = input_path.name
            else:
                run_id = f"ingest_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
        
        # Compute unique MMSI count
        unique_mmsi = set()
        for p in positions:
            if p.get("mmsi"):
                unique_mmsi.add(p["mmsi"])
        for s in static_records:
            if s.get("mmsi"):
                unique_mmsi.add(s["mmsi"])
        
        # Create fetch run record
        started_at = datetime.now(timezone.utc)
        fetch_run_id = maritime_db_writer.insert_fetch_run(
            self.conn,
            run_id=run_id,
            run_mode=run_mode,
            started_at=started_at,
            total_messages=stats["raw_messages_read"],
            position_messages=stats["positions_normalized"],
            static_messages=stats["static_normalized"],
            unique_mmsi_count=len(unique_mmsi),
            raw_path=str(input_path),
            status="completed",
        )
        
        # Process static records first
        for static in static_records:
            try:
                maritime_db_writer.upsert_vessel(
                    self.conn,
                    mmsi=static["mmsi"],
                    source_id=static.get("source_id", "aisstream"),
                    source_object_id=str(static["mmsi"]),
                    imo=static.get("imo"),
                    callsign=static.get("callsign"),
                    vessel_name=static.get("vessel_name"),
                    vessel_type_code=static.get("vessel_type_code"),
                    vessel_type=static.get("vessel_type"),
                    destination=static.get("destination"),
                    eta_month=static.get("eta_month"),
                    eta_day=static.get("eta_day"),
                    eta_hour=static.get("eta_hour"),
                    eta_minute=static.get("eta_minute"),
                    eta_display=static.get("eta_display"),
                    draught_meters=static.get("draught_meters"),
                    dimension_a=static.get("dimension_a"),
                    dimension_b=static.get("dimension_b"),
                    dimension_c=static.get("dimension_c"),
                    dimension_d=static.get("dimension_d"),
                    length_meters=static.get("length_meters"),
                    width_meters=static.get("width_meters"),
                    last_received_at=datetime.fromisoformat(static["received_at"].replace("Z", "+00:00")) if static.get("received_at") else None,
                    raw_evidence_uri=static.get("raw_evidence_uri"),
                    provider_metadata=static.get("provider_metadata"),
                )
                stats["vessels_upserted"] += 1
            except Exception as e:
                stats["errors"].append(f"vessel_upsert_error: {e}")
        
        # Process positions
        for position in positions:
            try:
                mmsi = position["mmsi"]
                received_at = datetime.fromisoformat(position["received_at"].replace("Z", "+00:00")) if position.get("received_at") else datetime.now(timezone.utc)
                raw_evidence_uri = position.get("raw_evidence_uri", "")
                
                # Ensure minimal vessel exists for position-only records
                maritime_db_writer.ensure_minimal_vessel_for_position(
                    self.conn,
                    mmsi=mmsi,
                    raw_evidence_uri=raw_evidence_uri,
                    received_at=received_at,
                )
                
                # Upsert latest position
                maritime_db_writer.upsert_position_latest(
                    self.conn,
                    mmsi=mmsi,
                    latitude=position["latitude"],
                    longitude=position["longitude"],
                    source_id=position.get("source_id", "aisstream"),
                    source_object_id=str(mmsi),
                    speed_over_ground=position.get("speed_over_ground"),
                    course_over_ground=position.get("course_over_ground"),
                    true_heading=position.get("true_heading"),
                    navigation_status=position.get("navigation_status"),
                    navigation_status_text=position.get("navigation_status_text"),
                    position_accuracy=position.get("position_accuracy"),
                    ais_timestamp_second=position.get("ais_timestamp_second"),
                    metadata_time_utc=position.get("metadata_time_utc"),
                    received_at=received_at,
                    raw_evidence_uri=raw_evidence_uri,
                    provider_metadata=position.get("provider_metadata"),
                )
                stats["positions_upserted"] += 1
                
                # Insert history
                maritime_db_writer.insert_position_history(
                    self.conn,
                    mmsi=mmsi,
                    latitude=position["latitude"],
                    longitude=position["longitude"],
                    source_id=position.get("source_id", "aisstream"),
                    source_object_id=str(mmsi),
                    speed_over_ground=position.get("speed_over_ground"),
                    course_over_ground=position.get("course_over_ground"),
                    true_heading=position.get("true_heading"),
                    navigation_status=position.get("navigation_status"),
                    ais_timestamp_second=position.get("ais_timestamp_second"),
                    metadata_time_utc=position.get("metadata_time_utc"),
                    received_at=received_at,
                    raw_evidence_uri=raw_evidence_uri,
                )
                stats["history_rows_inserted"] += 1
                
                # Insert raw message ref
                maritime_db_writer.insert_raw_message_ref(
                    self.conn,
                    message_type=position.get("message_type", "PositionReport"),
                    raw_evidence_uri=raw_evidence_uri,
                    received_at=received_at,
                    fetch_run_id=fetch_run_id,
                    mmsi=mmsi,
                    provider_metadata=position.get("provider_metadata"),
                )
                stats["raw_refs_inserted"] += 1
                
            except Exception as e:
                stats["errors"].append(f"position_upsert_error: {e}")
        
        # Update fetch run with completion stats
        ended_at = datetime.now(timezone.utc)
        duration_seconds = (ended_at - started_at).total_seconds()
        
        maritime_db_writer.update_fetch_run(
            self.conn,
            run_id=run_id,
            ended_at=ended_at,
            duration_seconds=duration_seconds,
            total_messages=stats["raw_messages_read"],
            position_messages=stats["positions_normalized"],
            static_messages=stats["static_normalized"],
            unique_mmsi_count=len(unique_mmsi),
            status="completed",
        )
        
        return stats

    def ingest_live(
        self,
        max_messages: int = 50,
        max_duration_seconds: float = 60.0,
        output_root: Path | None = None,
    ) -> dict[str, Any]:
        """Run live ingestion proof: connect to AISStream, capture, normalize, write to DB.
        
        Args:
            max_messages: Maximum messages to capture
            max_duration_seconds: Maximum duration in seconds
            output_root: Output directory for raw files
            
        Returns:
            Ingestion report dictionary.
        """
        from layers.layer_06_maritime.maritime_fetcher import MaritimeFetcher
        from layers.layer_06_maritime.maritime_raw_storage import MaritimeRawStorage
        
        # Create run ID
        run_id = f"live_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
        
        # Start fetch run record
        started_at = datetime.now(timezone.utc)
        fetch_run_id = maritime_db_writer.insert_fetch_run(
            self.conn,
            run_id=run_id,
            run_mode="continuous",
            started_at=started_at,
            raw_path=str(output_root / run_id) if output_root else None,
            status="running",
        )
        
        # Run the fetcher
        fetcher = MaritimeFetcher(output_root=output_root)
        fetch_result = fetcher.run_proof(
            max_messages=max_messages,
            max_duration_seconds=max_duration_seconds,
        )
        
        # Get the run directory from fetch result
        run_dir = fetch_result.get("run_dir")
        
        # Normalize the captured data
        if run_dir:
            norm_result = normalize_from_cache(Path(run_dir))
        else:
            norm_result = {
                "raw_messages_read": fetch_result.get("message_count", 0),
                "position_normalized": 0,
                "static_normalized": 0,
                "joined_vessels": 0,
                "skipped_invalid": 0,
                "positions": [],
                "static_records": [],
                "latest_by_mmsi": {},
            }
        
        stats = {
            "run_id": run_id,
            "fetch_result": fetch_result,
            "raw_messages_read": norm_result["raw_messages_read"],
            "positions_normalized": norm_result["position_normalized"],
            "static_normalized": norm_result["static_normalized"],
            "vessels_upserted": 0,
            "positions_upserted": 0,
            "history_rows_inserted": 0,
            "raw_refs_inserted": 0,
            "skipped_invalid": norm_result["skipped_invalid"],
            "errors": [],
        }
        
        # Process static records
        for static in norm_result.get("static_records", []):
            try:
                maritime_db_writer.upsert_vessel(
                    self.conn,
                    mmsi=static["mmsi"],
                    source_id=static.get("source_id", "aisstream"),
                    source_object_id=str(static["mmsi"]),
                    imo=static.get("imo"),
                    callsign=static.get("callsign"),
                    vessel_name=static.get("vessel_name"),
                    vessel_type_code=static.get("vessel_type_code"),
                    vessel_type=static.get("vessel_type"),
                    destination=static.get("destination"),
                    eta_month=static.get("eta_month"),
                    eta_day=static.get("eta_day"),
                    eta_hour=static.get("eta_hour"),
                    eta_minute=static.get("eta_minute"),
                    eta_display=static.get("eta_display"),
                    draught_meters=static.get("draught_meters"),
                    dimension_a=static.get("dimension_a"),
                    dimension_b=static.get("dimension_b"),
                    dimension_c=static.get("dimension_c"),
                    dimension_d=static.get("dimension_d"),
                    length_meters=static.get("length_meters"),
                    width_meters=static.get("width_meters"),
                    last_received_at=datetime.fromisoformat(static["received_at"].replace("Z", "+00:00")) if static.get("received_at") else None,
                    raw_evidence_uri=static.get("raw_evidence_uri"),
                    provider_metadata=static.get("provider_metadata"),
                )
                stats["vessels_upserted"] += 1
            except Exception as e:
                stats["errors"].append(f"vessel_upsert_error: {e}")
        
        # Process positions
        for position in norm_result.get("positions", []):
            try:
                mmsi = position["mmsi"]
                received_at = datetime.fromisoformat(position["received_at"].replace("Z", "+00:00")) if position.get("received_at") else datetime.now(timezone.utc)
                raw_evidence_uri = position.get("raw_evidence_uri", "")
                
                maritime_db_writer.ensure_minimal_vessel_for_position(
                    self.conn,
                    mmsi=mmsi,
                    raw_evidence_uri=raw_evidence_uri,
                    received_at=received_at,
                )
                
                maritime_db_writer.upsert_position_latest(
                    self.conn,
                    mmsi=mmsi,
                    latitude=position["latitude"],
                    longitude=position["longitude"],
                    source_id=position.get("source_id", "aisstream"),
                    source_object_id=str(mmsi),
                    speed_over_ground=position.get("speed_over_ground"),
                    course_over_ground=position.get("course_over_ground"),
                    true_heading=position.get("true_heading"),
                    navigation_status=position.get("navigation_status"),
                    navigation_status_text=position.get("navigation_status_text"),
                    position_accuracy=position.get("position_accuracy"),
                    ais_timestamp_second=position.get("ais_timestamp_second"),
                    metadata_time_utc=position.get("metadata_time_utc"),
                    received_at=received_at,
                    raw_evidence_uri=raw_evidence_uri,
                    provider_metadata=position.get("provider_metadata"),
                )
                stats["positions_upserted"] += 1
                
                maritime_db_writer.insert_position_history(
                    self.conn,
                    mmsi=mmsi,
                    latitude=position["latitude"],
                    longitude=position["longitude"],
                    source_id=position.get("source_id", "aisstream"),
                    source_object_id=str(mmsi),
                    speed_over_ground=position.get("speed_over_ground"),
                    course_over_ground=position.get("course_over_ground"),
                    true_heading=position.get("true_heading"),
                    navigation_status=position.get("navigation_status"),
                    ais_timestamp_second=position.get("ais_timestamp_second"),
                    metadata_time_utc=position.get("metadata_time_utc"),
                    received_at=received_at,
                    raw_evidence_uri=raw_evidence_uri,
                )
                stats["history_rows_inserted"] += 1
                
                maritime_db_writer.insert_raw_message_ref(
                    self.conn,
                    message_type=position.get("message_type", "PositionReport"),
                    raw_evidence_uri=raw_evidence_uri,
                    received_at=received_at,
                    fetch_run_id=fetch_run_id,
                    mmsi=mmsi,
                    provider_metadata=position.get("provider_metadata"),
                )
                stats["raw_refs_inserted"] += 1
                
            except Exception as e:
                stats["errors"].append(f"position_upsert_error: {e}")
        
        # Update fetch run with completion stats
        ended_at = datetime.now(timezone.utc)
        duration_seconds = (ended_at - started_at).total_seconds()
        
        maritime_db_writer.update_fetch_run(
            self.conn,
            run_id=run_id,
            ended_at=ended_at,
            duration_seconds=duration_seconds,
            total_messages=fetch_result.get("message_count", 0),
            position_messages=stats["positions_normalized"],
            static_messages=stats["static_normalized"],
            unique_mmsi_count=fetch_result.get("unique_mmsi_count", 0),
            status="completed",
        )
        
        return stats


def run_ingestion(
    input_path: Path | None = None,
    run_id: str | None = None,
    dry_run: bool = False,
    database_url: str | None = None,
) -> dict[str, Any]:
    """Convenience function to run ingestion.
    
    Args:
        input_path: Path to raw messages (for ingest-from-cache)
        run_id: Optional run ID
        dry_run: If True, normalize but don't write to DB
        database_url: Database connection string
        
    Returns:
        Ingestion report dictionary.
    """
    ingestion = MaritimeIngestion(database_url=database_url, dry_run=dry_run)
    try:
        if input_path:
            return ingestion.ingest_from_cache(input_path, run_id=run_id)
        else:
            return ingestion.ingest_live()
    finally:
        ingestion.close()