"""Maritime Normalizer

Normalizes raw AISStream messages into standard vessel/position objects.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Navigation status mapping
NAVIGATION_STATUS = {
    0: "under_way_using_engine",
    1: "at_anchor",
    2: "not_under_command",
    3: "restricted_manoeuvrability",
    4: "constrained_by_draft",
    5: "moored",
    6: "aground",
    7: "engaged_in_fishing",
    8: "under_way_sailing",
    9: "reserved_for_hsc",
    10: "reserved_for_wig",
    11: "power_driven_vessel_towing_astern",
    12: "power_driven_vessel_pushing_ahead",
    13: "reserved",
    14: "ais_sart",
    15: "not_defined"
}

# Ship type code mapping
SHIP_TYPE_CODES = {
    0: "not_available",
    20: "wing_in_ground",
    21: "wing_in_ground",
    22: "wing_in_ground",
    23: "wing_in_ground",
    24: "wing_in_ground",
    25: "wing_in_ground",
    26: "wing_in_ground",
    27: "wing_in_ground",
    28: "wing_in_ground",
    29: "wing_in_ground",
    30: "fishing",
    31: "towing",
    32: "towing_large",
    33: "dredging",
    34: "diving",
    35: "military",
    36: "sailing",
    37: "pleasure_craft",
    38: "pleasure_craft",
    39: "pleasure_craft",
    40: "hsc",
    41: "hsc",
    42: "hsc",
    43: "hsc",
    44: "hsc",
    45: "hsc",
    46: "hsc",
    47: "hsc",
    48: "hsc",
    49: "hsc",
    50: "pilot_vessel",
    51: "search_and_rescue",
    52: "tug",
    53: "port_tender",
    54: "anti_pollution",
    55: "law_enforcement",
    56: "law_enforcement",
    57: "law_enforcement",
    58: "law_enforcement",
    59: "law_enforcement",
    60: "passenger",
    61: "passenger",
    62: "passenger",
    63: "passenger",
    64: "passenger",
    65: "passenger",
    66: "passenger",
    67: "passenger",
    68: "passenger",
    69: "passenger",
    70: "cargo",
    71: "cargo_hazard_a",
    72: "cargo_hazard_b",
    73: "cargo_hazard_c",
    74: "cargo_hazard_d",
    75: "cargo_hazard_other",
    76: "cargo_hazard_other",
    77: "cargo_hazard_other",
    78: "cargo_hazard_other",
    79: "cargo",
    80: "tanker",
    81: "tanker_hazard_a",
    82: "tanker_hazard_b",
    83: "tanker_hazard_c",
    84: "tanker_hazard_d",
    85: "tanker_hazard_other",
    86: "tanker_hazard_other",
    87: "tanker_hazard_other",
    88: "tanker_hazard_other",
    89: "tanker",
    90: "other",
    91: "other",
    92: "other",
    93: "other",
    94: "other",
    95: "other",
    96: "other",
    97: "other",
    98: "other",
    99: "other"
}


def normalize_position_report(raw: dict[str, Any], raw_evidence_uri: str) -> dict[str, Any] | None:
    """Normalize a PositionReport message."""
    message = raw.get("Message", {})
    if not isinstance(message, dict):
        return None

    # Get the nested PositionReport content
    pos_data = message.get("PositionReport")
    if not pos_data or not isinstance(pos_data, dict):
        return None

    # Extract MMSI from MetaData (camelCase)
    mmsi = raw.get("MetaData", {}).get("MMSI")
    if not mmsi:
        return None

    # Validate lat/lon
    lat = pos_data.get("Latitude")
    lon = pos_data.get("Longitude")
    if lat is None or lon is None:
        return None

    # Check valid range
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return None

    # Extract fields with safe conversions
    sog = pos_data.get("Sog")
    cog = pos_data.get("Cog")
    true_heading = pos_data.get("TrueHeading")

    # TrueHeading 511 = not available
    if true_heading == 511:
        true_heading = None

    nav_status = pos_data.get("NavigationalStatus")
    nav_status_text = NAVIGATION_STATUS.get(nav_status) if nav_status is not None else None

    position_accuracy = pos_data.get("PositionAccuracy")

    # Timestamp is integer seconds since minute start
    timestamp_second = pos_data.get("Timestamp")

    # Get metadata time if available
    metadata_time = raw.get("MetaData", {}).get("time_utc")

    return {
        "layer_id": "layer_06_maritime",
        "source_id": "aisstream",
        "source_family": "ais",
        "message_type": "PositionReport",
        "ais_message_type": pos_data.get("MessageID"),
        "mmsi": mmsi,
        "latitude": lat,
        "longitude": lon,
        "speed_over_ground": sog,
        "course_over_ground": cog,
        "true_heading": true_heading,
        "navigation_status": nav_status,
        "navigation_status_text": nav_status_text,
        "position_accuracy": position_accuracy,
        "ais_timestamp_second": timestamp_second,
        "received_at": raw.get("received_at"),
        "metadata_time_utc": metadata_time,
        "raw_evidence_uri": raw_evidence_uri,
        "provider_metadata": {
            "message_type": "PositionReport",
            "ais_message_type": pos_data.get("MessageID"),
            "source": "aisstream"
        }
    }


def normalize_ship_static_data(raw: dict[str, Any], raw_evidence_uri: str) -> dict[str, Any] | None:
    """Normalize a ShipStaticData message."""
    message = raw.get("Message", {})
    if not isinstance(message, dict):
        return None

    # Get the nested ShipStaticData content
    static_data = message.get("ShipStaticData")
    if not static_data or not isinstance(static_data, dict):
        return None

    # Extract MMSI
    mmsi = raw.get("MetaData", {}).get("MMSI")
    if not mmsi:
        return None

    # Extract fields
    imo = static_data.get("ImoNumber")
    if imo == 0:
        imo = None

    callsign = static_data.get("CallSign")
    if callsign is not None:
        callsign = callsign.strip() or None
        if callsign == "":
            callsign = None

    vessel_name = static_data.get("Name")
    if vessel_name is not None:
        vessel_name = vessel_name.strip() or None
        if vessel_name == "":
            vessel_name = None

    vessel_type_code = static_data.get("Type")
    vessel_type = SHIP_TYPE_CODES.get(vessel_type_code) if vessel_type_code is not None else None

    # Handle dimensions
    dimension = static_data.get("Dimension", {})
    if isinstance(dimension, dict):
        dim_a = dimension.get("A", 0) or 0
        dim_b = dimension.get("B", 0) or 0
        dim_c = dimension.get("C", 0) or 0
        dim_d = dimension.get("D", 0) or 0
        length_meters = dim_a + dim_b if (dim_a and dim_b) else None
        width_meters = dim_c + dim_d if (dim_c and dim_d) else None
    else:
        length_meters = None
        width_meters = None

    # Handle ETA - partial fields only
    eta = static_data.get("Eta")
    eta_month = None
    eta_day = None
    eta_hour = None
    eta_minute = None
    eta_display = None

    if isinstance(eta, dict):
        eta_month = eta.get("Month")
        eta_day = eta.get("Day")
        eta_hour = eta.get("Hour")
        eta_minute = eta.get("Minute")

        # Build display string from partial data
        parts = []
        if eta_month:
            parts.append(f"{eta_month:02d}")
        if eta_day:
            parts.append(f"{eta_day:02d}")
        if eta_hour is not None:
            parts.append(f"{eta_hour:02d}")
        if eta_minute is not None:
            parts.append(f"{eta_minute:02d}")
        eta_display = "-".join(parts) if parts else None

    # Handle destination
    destination = static_data.get("Destination")
    if destination is not None:
        destination = destination.strip() or None
        if destination == "":
            destination = None

    # Handle draught
    draught = static_data.get("MaximumStaticDraught")

    # Get metadata time if available
    metadata_time = raw.get("MetaData", {}).get("time_utc")

    return {
        "layer_id": "layer_06_maritime",
        "source_id": "aisstream",
        "source_family": "ais",
        "message_type": "ShipStaticData",
        "ais_message_type": static_data.get("MessageID"),
        "mmsi": mmsi,
        "imo": imo,
        "callsign": callsign,
        "vessel_name": vessel_name,
        "vessel_type_code": vessel_type_code,
        "vessel_type": vessel_type,
        "destination": destination,
        "eta_month": eta_month,
        "eta_day": eta_day,
        "eta_hour": eta_hour,
        "eta_minute": eta_minute,
        "eta_display": eta_display,
        "draught_meters": draught,
        "dimension_a": dimension.get("A") if isinstance(dimension, dict) else None,
        "dimension_b": dimension.get("B") if isinstance(dimension, dict) else None,
        "dimension_c": dimension.get("C") if isinstance(dimension, dict) else None,
        "dimension_d": dimension.get("D") if isinstance(dimension, dict) else None,
        "length_meters": length_meters,
        "width_meters": width_meters,
        "received_at": raw.get("received_at"),
        "metadata_time_utc": metadata_time,
        "raw_evidence_uri": raw_evidence_uri,
        "provider_metadata": {
            "message_type": "ShipStaticData",
            "ais_message_type": static_data.get("MessageID"),
            "source": "aisstream"
        }
    }


def join_vessel(position: dict[str, Any] | None, static: dict[str, Any] | None) -> dict[str, Any] | None:
    """Join position and static data by MMSI."""
    if position is None and static is None:
        return None

    mmsi = None
    if position:
        mmsi = position.get("mmsi")
    if static and not mmsi:
        mmsi = static.get("mmsi")

    if not mmsi:
        return None

    result = {
        "layer_id": "layer_06_maritime",
        "source_id": "aisstream",
        "source_family": "ais",
        "mmsi": mmsi,
        "dedupe_key": f"aisstream:{mmsi}"
    }

    # Add position fields if available
    if position:
        result.update({
            "latitude": position.get("latitude"),
            "longitude": position.get("longitude"),
            "speed_over_ground": position.get("speed_over_ground"),
            "course_over_ground": position.get("course_over_ground"),
            "true_heading": position.get("true_heading"),
            "navigation_status": position.get("navigation_status"),
            "navigation_status_text": position.get("navigation_status_text"),
            "position_accuracy": position.get("position_accuracy"),
            "ais_timestamp_second": position.get("ais_timestamp_second"),
            "position_received_at": position.get("received_at"),
            "position_provider_metadata": position.get("provider_metadata")
        })

    # Add static fields if available
    if static:
        result.update({
            "imo": static.get("imo"),
            "callsign": static.get("callsign"),
            "vessel_name": static.get("vessel_name"),
            "vessel_type_code": static.get("vessel_type_code"),
            "vessel_type": static.get("vessel_type"),
            "destination": static.get("destination"),
            "eta_month": static.get("eta_month"),
            "eta_day": static.get("eta_day"),
            "eta_hour": static.get("eta_hour"),
            "eta_minute": static.get("eta_minute"),
            "eta_display": static.get("eta_display"),
            "draught_meters": static.get("draught_meters"),
            "length_meters": static.get("length_meters"),
            "width_meters": static.get("width_meters"),
            "static_received_at": static.get("received_at"),
            "static_provider_metadata": static.get("provider_metadata")
        })

    # Use position received_at as primary, fallback to static
    result["received_at"] = position.get("received_at") if position else static.get("received_at")

    return result


def normalize_from_cache(input_path: Path, output_dir: Path | None = None) -> dict[str, Any]:
    """Normalize all messages from a raw cache.

    Args:
        input_path: Either a run directory containing raw_messages.jsonl,
                   or a direct path to raw_messages.jsonl
        output_dir: Output directory for normalized files. If None, creates
                   normalized/ subdirectory next to input.

    Returns:
        Normalization report dictionary.
    """
    # Determine input file
    if input_path.is_dir():
        raw_file = input_path / "raw_messages.jsonl"
        run_dir = input_path
    else:
        raw_file = input_path
        run_dir = raw_file.parent

    # Determine output directory
    if output_dir is None:
        output_dir = run_dir / "normalized"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Track statistics
    stats = {
        "raw_messages_read": 0,
        "position_normalized": 0,
        "static_normalized": 0,
        "skipped_invalid": 0,
        "skipped_reasons": {},
        "positions": [],
        "static_records": [],
        "latest_by_mmsi": {}
    }

    # Read and normalize messages
    if not raw_file.exists():
        stats["skipped_reasons"]["file_not_found"] = 1
        return stats

    raw_evidence_uri = str(raw_file)

    with open(raw_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue

            stats["raw_messages_read"] += 1

            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                stats["skipped_invalid"] += 1
                stats["skipped_reasons"]["json_decode_error"] = \
                    stats["skipped_reasons"].get("json_decode_error", 0) + 1
                continue

            msg_type = raw.get("MessageType")

            if msg_type == "PositionReport":
                normalized = normalize_position_report(raw, raw_evidence_uri)
                if normalized:
                    stats["position_normalized"] += 1
                    stats["positions"].append(normalized)

                    # Track latest by MMSI
                    mmsi = normalized["mmsi"]
                    existing = stats["latest_by_mmsi"].get(mmsi, {})
                    if not existing.get("position") or \
                       normalized.get("received_at", "") > existing.get("position", {}).get("received_at", ""):
                        existing["position"] = normalized
                        stats["latest_by_mmsi"][mmsi] = existing
                else:
                    stats["skipped_invalid"] += 1
                    stats["skipped_reasons"]["position_normalize_failed"] = \
                        stats["skipped_reasons"].get("position_normalize_failed", 0) + 1

            elif msg_type == "ShipStaticData":
                normalized = normalize_ship_static_data(raw, raw_evidence_uri)
                if normalized:
                    stats["static_normalized"] += 1
                    stats["static_records"].append(normalized)

                    # Track latest by MMSI
                    mmsi = normalized["mmsi"]
                    existing = stats["latest_by_mmsi"].get(mmsi, {})
                    if not existing.get("static") or \
                       normalized.get("received_at", "") > existing.get("static", {}).get("received_at", ""):
                        existing["static"] = normalized
                        stats["latest_by_mmsi"][mmsi] = existing
                else:
                    stats["skipped_invalid"] += 1
                    stats["skipped_reasons"]["static_normalize_failed"] = \
                        stats["skipped_reasons"].get("static_normalize_failed", 0) + 1
            else:
                stats["skipped_invalid"] += 1
                stats["skipped_reasons"]["unknown_message_type"] = \
                    stats["skipped_reasons"].get("unknown_message_type", 0) + 1

    # Join position + static for each MMSI
    latest_vessels = []
    for mmsi, data in stats["latest_by_mmsi"].items():
        vessel = join_vessel(data.get("position"), data.get("static"))
        if vessel:
            latest_vessels.append(vessel)

    stats["joined_vessels"] = len(latest_vessels)

    # Write outputs
    positions_out = output_dir / "normalized_positions.jsonl"
    with open(positions_out, "w", encoding="utf-8") as f:
        for p in stats["positions"]:
            f.write(json.dumps(p) + "\n")

    static_out = output_dir / "normalized_static.jsonl"
    with open(static_out, "w", encoding="utf-8") as f:
        for s in stats["static_records"]:
            f.write(json.dumps(s) + "\n")

    vessels_out = output_dir / "normalized_vessels_latest.jsonl"
    with open(vessels_out, "w", encoding="utf-8") as f:
        for v in latest_vessels:
            f.write(json.dumps(v) + "\n")

    # Write report
    report = {
        "input_file": str(raw_file),
        "output_dir": str(output_dir),
        "raw_messages_read": stats["raw_messages_read"],
        "position_normalized": stats["position_normalized"],
        "static_normalized": stats["static_normalized"],
        "joined_vessels": stats["joined_vessels"],
        "skipped_invalid": stats["skipped_invalid"],
        "skipped_reasons": stats["skipped_reasons"],
        "outputs": {
            "positions": str(positions_out),
            "static": str(static_out),
            "vessels": str(vessels_out)
        }
    }

    report_json = output_dir / "normalization_report.json"
    with open(report_json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    # Also write markdown report
    report_md = output_dir / "normalization_report.md"
    with open(report_md, "w", encoding="utf-8") as f:
        f.write("# Maritime Normalization Report\n\n")
        f.write(f"**Input**: {raw_file}\n\n")
        f.write(f"**Output Directory**: {output_dir}\n\n")
        f.write("## Summary\n\n")
        f.write(f"- Raw messages read: {stats['raw_messages_read']}\n")
        f.write(f"- Position reports normalized: {stats['position_normalized']}\n")
        f.write(f"- Ship static data normalized: {stats['static_normalized']}\n")
        f.write(f"- Joined vessels: {stats['joined_vessels']}\n")
        f.write(f"- Skipped/invalid: {stats['skipped_invalid']}\n\n")

        if stats["skipped_reasons"]:
            f.write("## Skip Reasons\n\n")
            for reason, count in stats["skipped_reasons"].items():
                f.write(f"- {reason}: {count}\n")

        f.write("\n## Output Files\n\n")
        f.write(f"- Positions: {positions_out.name}\n")
        f.write(f"- Static: {static_out.name}\n")
        f.write(f"- Vessels: {vessels_out.name}\n")

    return report