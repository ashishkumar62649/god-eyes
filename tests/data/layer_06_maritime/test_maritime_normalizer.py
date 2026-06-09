"""Tests for maritime normalizer."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest


# Execute normalizer code in test namespace
NORMALIZER_CODE = '''
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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

SHIP_TYPE_CODES = {
    0: "not_available",
    70: "cargo",
    80: "tanker",
    60: "passenger",
    50: "pilot_vessel",
}

def normalize_position_report(raw, raw_evidence_uri):
    message = raw.get("Message", {})
    if not isinstance(message, dict):
        return None
    pos_data = message.get("PositionReport")
    if not pos_data or not isinstance(pos_data, dict):
        return None
    mmsi = raw.get("MetaData", {}).get("MMSI")
    if not mmsi:
        return None
    lat = pos_data.get("Latitude")
    lon = pos_data.get("Longitude")
    if lat is None or lon is None:
        return None
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return None
    sog = pos_data.get("Sog")
    cog = pos_data.get("Cog")
    true_heading = pos_data.get("TrueHeading")
    if true_heading == 511:
        true_heading = None
    nav_status = pos_data.get("NavigationalStatus")
    nav_status_text = NAVIGATION_STATUS.get(nav_status) if nav_status is not None else None
    position_accuracy = pos_data.get("PositionAccuracy")
    timestamp_second = pos_data.get("Timestamp")
    metadata_time = raw.get("MetaData", {}).get("time_utc")
    return {
        "layer_id": "layer_06_maritime",
        "source_id": "aisstream",
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
    }

def normalize_ship_static_data(raw, raw_evidence_uri):
    message = raw.get("Message", {})
    if not isinstance(message, dict):
        return None
    static_data = message.get("ShipStaticData")
    if not static_data or not isinstance(static_data, dict):
        return None
    mmsi = raw.get("MetaData", {}).get("MMSI")
    if not mmsi:
        return None
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
    eta = static_data.get("Eta")
    eta_month = eta_day = eta_hour = eta_minute = eta_display = None
    if isinstance(eta, dict):
        eta_month = eta.get("Month")
        eta_day = eta.get("Day")
        eta_hour = eta.get("Hour")
        eta_minute = eta.get("Minute")
        parts = []
        if eta_month: parts.append(f"{eta_month:02d}")
        if eta_day: parts.append(f"{eta_day:02d}")
        if eta_hour is not None: parts.append(f"{eta_hour:02d}")
        if eta_minute is not None: parts.append(f"{eta_minute:02d}")
        eta_display = "-".join(parts) if parts else None
    destination = static_data.get("Destination")
    if destination is not None:
        destination = destination.strip() or None
        if destination == "":
            destination = None
    draught = static_data.get("MaximumStaticDraught")
    metadata_time = raw.get("MetaData", {}).get("time_utc")
    return {
        "layer_id": "layer_06_maritime",
        "source_id": "aisstream",
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
        "length_meters": length_meters,
        "width_meters": width_meters,
        "received_at": raw.get("received_at"),
        "metadata_time_utc": metadata_time,
        "raw_evidence_uri": raw_evidence_uri,
    }

def join_vessel(position, static):
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
        "mmsi": mmsi,
        "dedupe_key": f"aisstream:{mmsi}"
    }
    if position:
        result.update({
            "latitude": position.get("latitude"),
            "longitude": position.get("longitude"),
            "speed_over_ground": position.get("speed_over_ground"),
            "course_over_ground": position.get("course_over_ground"),
            "true_heading": position.get("true_heading"),
            "navigation_status": position.get("navigation_status"),
            "navigation_status_text": position.get("navigation_status_text"),
        })
    if static:
        result.update({
            "imo": static.get("imo"),
            "callsign": static.get("callsign"),
            "vessel_name": static.get("vessel_name"),
            "vessel_type_code": static.get("vessel_type_code"),
            "vessel_type": static.get("vessel_type"),
            "destination": static.get("destination"),
            "length_meters": static.get("length_meters"),
            "width_meters": static.get("width_meters"),
        })
    result["received_at"] = position.get("received_at") if position else static.get("received_at")
    return result
'''

ns = {}
exec(NORMALIZER_CODE, ns)
normalize_position_report = ns["normalize_position_report"]
normalize_ship_static_data = ns["normalize_ship_static_data"]
join_vessel = ns["join_vessel"]


class TestPositionNormalization:
    """Tests for PositionReport normalization."""

    FIXTURE_DIR = Path(__file__).parent / "fixtures"

    def test_normalize_position_with_meta_data(self):
        """Normalize PositionReport with MetaData camelCase."""
        raw = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": 123456789, "ShipName": "TESTSHIP"},
            "Message": {
                "PositionReport": {
                    "MessageID": 3,
                    "UserID": 123456789,
                    "Latitude": 53.5,
                    "Longitude": 9.8,
                    "Sog": 10.5,
                    "Cog": 180.0,
                    "TrueHeading": 180,
                    "NavigationalStatus": 0,
                    "Timestamp": 45
                }
            },
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_position_report(raw, "test.jsonl")
        
        assert result is not None
        assert result["mmsi"] == 123456789
        assert result["latitude"] == 53.5
        assert result["longitude"] == 9.8
        assert result["speed_over_ground"] == 10.5
        assert result["course_over_ground"] == 180.0
        assert result["true_heading"] == 180
        assert result["navigation_status"] == 0
        assert result["navigation_status_text"] == "under_way_using_engine"

    def test_sog_to_speed_over_ground(self):
        """Sog maps to speed_over_ground."""
        raw = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": 111111111},
            "Message": {"PositionReport": {"UserID": 111111111, "Latitude": 50.0, "Longitude": 10.0, "Sog": 15.5}},
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_position_report(raw, "test.jsonl")
        assert result["speed_over_ground"] == 15.5

    def test_cog_to_course_over_ground(self):
        """Cog maps to course_over_ground."""
        raw = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": 222222222},
            "Message": {"PositionReport": {"UserID": 222222222, "Latitude": 50.0, "Longitude": 10.0, "Cog": 90.5}},
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_position_report(raw, "test.jsonl")
        assert result["course_over_ground"] == 90.5

    def test_true_heading_511_unavailable(self):
        """TrueHeading 511 handled as unavailable."""
        raw = {
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": 333333333},
            "Message": {"PositionReport": {"UserID": 333333333, "Latitude": 50.0, "Longitude": 10.0, "TrueHeading": 511}},
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_position_report(raw, "test.jsonl")
        assert result["true_heading"] is None


class TestStaticNormalization:
    """Tests for ShipStaticData normalization."""

    def test_normalize_ship_static_data(self):
        """Normalize ShipStaticData with Dimension."""
        raw = {
            "MessageType": "ShipStaticData",
            "MetaData": {"MMSI": 444444444, "ShipName": "CARGO"},
            "Message": {
                "ShipStaticData": {
                    "MessageID": 5,
                    "UserID": 444444444,
                    "Name": "CARGO SHIP",
                    "Type": 70,
                    "ImoNumber": 1234567,
                    "CallSign": "ABCD",
                    "Dimension": {"A": 100, "B": 30, "C": 15, "D": 15},
                    "Destination": "ROTTERDAM",
                    "MaximumStaticDraught": 12.5
                }
            },
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_ship_static_data(raw, "test.jsonl")
        
        assert result is not None
        assert result["mmsi"] == 444444444
        assert result["vessel_name"] == "CARGO SHIP"
        assert result["vessel_type_code"] == 70
        assert result["vessel_type"] == "cargo"
        assert result["imo"] == 1234567
        assert result["callsign"] == "ABCD"
        assert result["length_meters"] == 130
        assert result["width_meters"] == 30

    def test_imo_zero_to_none(self):
        """ImoNumber 0 maps to None."""
        raw = {
            "MessageType": "ShipStaticData",
            "MetaData": {"MMSI": 555555555},
            "Message": {"ShipStaticData": {"UserID": 555555555, "ImoNumber": 0}},
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_ship_static_data(raw, "test.jsonl")
        assert result["imo"] is None

    def test_empty_string_to_none(self):
        """Empty string fields map to None."""
        raw = {
            "MessageType": "ShipStaticData",
            "MetaData": {"MMSI": 666666666},
            "Message": {"ShipStaticData": {"UserID": 666666666, "CallSign": "   ", "Name": ""}},
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_ship_static_data(raw, "test.jsonl")
        assert result["callsign"] is None
        assert result["vessel_name"] is None

    def test_dimension_length_width(self):
        """Dimension A+B = length_meters, C+D = width_meters."""
        raw = {
            "MessageType": "ShipStaticData",
            "MetaData": {"MMSI": 777777777},
            "Message": {"ShipStaticData": {"UserID": 777777777, "Dimension": {"A": 80, "B": 20, "C": 10, "D": 10}}},
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_ship_static_data(raw, "test.jsonl")
        assert result["length_meters"] == 100
        assert result["width_meters"] == 20

    def test_eta_partial_handling(self):
        """ETA preserved as partial fields."""
        raw = {
            "MessageType": "ShipStaticData",
            "MetaData": {"MMSI": 888888888},
            "Message": {"ShipStaticData": {"UserID": 888888888, "Eta": {"Day": 15, "Hour": 10, "Minute": 30, "Month": 6}}},
            "received_at": "2026-06-09T12:00:00Z"
        }
        
        result = normalize_ship_static_data(raw, "test.jsonl")
        assert result["eta_day"] == 15
        assert result["eta_hour"] == 10
        assert result["eta_minute"] == 30
        assert result["eta_month"] == 6
        assert result["eta_display"] == "06-15-10-30"


class TestVesselJoin:
    """Tests for vessel joining."""

    def test_join_position_and_static(self):
        """Join position + static by MMSI."""
        position = {"mmsi": 123, "latitude": 50.0, "longitude": 10.0, "received_at": "2026-06-09T12:00:00Z"}
        static = {"mmsi": 123, "vessel_name": "SHIP", "vessel_type": "cargo", "received_at": "2026-06-09T12:00:01Z"}
        
        result = join_vessel(position, static)
        
        assert result is not None
        assert result["mmsi"] == 123
        assert result["latitude"] == 50.0
        assert result["vessel_name"] == "SHIP"
        assert result["dedupe_key"] == "aisstream:123"

    def test_join_position_only(self):
        """Position-only vessel output works."""
        position = {"mmsi": 456, "latitude": 51.0, "longitude": 11.0, "received_at": "2026-06-09T12:00:00Z"}
        
        result = join_vessel(position, None)
        
        assert result is not None
        assert result["latitude"] == 51.0
        assert "vessel_name" not in result or result.get("vessel_name") is None

    def test_join_static_only(self):
        """Static-only vessel output works."""
        static = {"mmsi": 789, "vessel_name": "STATIC_SHIP", "received_at": "2026-06-09T12:00:00Z"}
        
        result = join_vessel(None, static)
        
        assert result is not None
        assert result["vessel_name"] == "STATIC_SHIP"
        assert "latitude" not in result or result.get("latitude") is None