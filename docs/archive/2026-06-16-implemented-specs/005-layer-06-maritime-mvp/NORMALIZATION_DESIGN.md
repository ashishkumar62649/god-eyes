# Normalization Design: Maritime / Live Ships Layer

## Overview

Plan the normalization stage for Layer 06 Maritime. The normalizer reads raw AIS messages from disk, parses them into standardized vessel and position objects, and prepares them for database storage.

**Do not invent fields.** All fields below must be verified against actual AISStream raw messages during fetch proof (WO-MAR-S).

---

## AISStream Message Types

Based on AISStream documentation, the primary message types are:

### 1. PositionReport (AIS Message Types 1, 2, 3)

Standard class A position reports from vessels with class A transponders.

**Expected fields:**
| Field | Type | Description |
|-------|------|-------------|
| `UserID` | int | MMSI (Maritime Mobile Service Identity) |
| `Latitude` | float | Position latitude (degrees, N positive) |
| `Longitude` | float | Position longitude (degrees, E positive) |
| `Speed` | float | Speed over ground (knots) |
| `Course` | float | Course over ground (degrees true) |
| `Heading` | int | True heading (degrees, 0-359, 511 = not available) |
| `NavigationalStatus` | int | AIS navigational status code (0-15) |
| `TimeStamp` | string | AIS timestamp (UTC, format TBD) |

### 2. ShipStaticData (AIS Message Type 5)

Static vessel information (sent periodically, not on every position report).

**Expected fields:**
| Field | Type | Description |
|-------|------|-------------|
| `UserID` | int | MMSI |
| `Imo` | int | IMO number (may be 0 if not available) |
| `CallSign` | string | Vessel callsign |
| `Name` | string | Vessel name |
| `ShipType` | int | AIS ship type code (0-255) |
| `Length` | float | Vessel length (meters) |
| `Width` | float | Vessel width (meters) |
| `Destination` | string | Destination port (may be empty) |
| `Eta` | string | Estimated time of arrival (UTC) |
| `Draught` | float | Current draught (meters) |

### 3. StandardClassBCSPositionReport (AIS Message Type 18)

Class B transponder positions (smaller vessels, recreational).

**Expected fields:**
| Field | Type | Description |
|-------|------|-------------|
| `UserID` | int | MMSI |
| `Latitude` | float | Position latitude |
| `Longitude` | float | Position longitude |
| `Speed` | float | Speed over ground |
| `Course` | float | Course over ground |
| `Heading` | int | True heading |
| `TimeStamp` | string | AIS timestamp |

### 4. LongRangeIntervalMessage (AIS Message Type 27)

Long-range position reports for ocean passages (lower accuracy).

**Expected fields:**
| Field | Type | Description |
|-------|------|-------------|
| `UserID` | int | MMSI |
| `Latitude` | float | Position latitude (lower precision) |
| `Longitude` | float | Position longitude (lower precision) |
| `Speed` | float | Speed over ground |
| `Course` | float | Course over ground |
| `NavigationalStatus` | int | Navigational status |

---

## Position Report Normalization

### Input

Raw AISStream PositionReport message (from raw_messages.jsonl).

### Output: Normalized Position Object

```python
{
    "source_id": "aisstream",
    "source_family": "ais",
    "mmsi": int,                     # from UserID
    "imo": None,                     # not in PositionReport
    "callsign": None,                # not in PositionReport
    "vessel_name": None,             # not in PositionReport
    "vessel_type": None,             # not in PositionReport (mapped from ShipStaticData)
    "vessel_type_code": None,        # AIS ship type code (from ShipStaticData)
    "latitude": float,               # from Latitude
    "longitude": float,              # from Longitude
    "speed_over_ground": float,      # from Speed (knots)
    "course_over_ground": float,     # from Course (degrees)
    "true_heading": int,             # from Heading (degrees, 0-359)
    "navigation_status": int,        # from NavigationalStatus (0-15)
    "navigation_status_text": str,   # human-readable status
    "destination": None,             # not in PositionReport
    "eta": None,                     # not in PositionReport
    "timestamp_utc": datetime,       # from TimeStamp (AIS transmission time)
    "received_at": datetime,         # when we received the message
    "position_accuracy": None,       # may be in raw data (TBD)
    "draught": None,                 # not in PositionReport
    "dimensions": None,              # not in PositionReport
    "raw_evidence_uri": str,         # path to raw_messages.jsonl
    "provider_metadata": {
        "message_type": "PositionReport",
        "ais_message_type": int,     # 1, 2, or 3
        "source": "aisstream"
    }
}
```

### Navigation Status Codes

```python
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
```

---

## Ship Static Data Normalization

### Input

Raw AISStream ShipStaticData message.

### Output: Normalized Static Object

```python
{
    "source_id": "aisstream",
    "source_family": "ais",
    "mmsi": int,                     # from UserID
    "imo": int or None,              # from Imo (0 = not available)
    "callsign": str,                 # from CallSign
    "vessel_name": str,              # from Name
    "vessel_type": str,              # mapped from ShipType code
    "vessel_type_code": int,         # raw ShipType code
    "length": float or None,         # from Length (meters)
    "width": float or None,          # from Width (meters)
    "destination": str,              # from Destination
    "eta": datetime or None,         # from Eta
    "draught": float or None,        # from Draught (meters)
    "timestamp_utc": datetime,       # from TimeStamp
    "received_at": datetime,
    "raw_evidence_uri": str,
    "provider_metadata": {
        "message_type": "ShipStaticData",
        "ais_message_type": 5,
        "source": "aisstream"
    }
}
```

### Ship Type Code Mapping

```python
SHIP_TYPE_CODES = {
    0: "not_available",
    20: "wing_in_ground",
    30: "fishing",
    31: "towing",
    32: "towing_large",
    33: "dredging",
    34: "diving",
    35: "military",
    36: "sailing",
    37: "pleasure_craft",
    40: "hsc",
    50: "pilot_vessel",
    51: "search_and_rescue",
    52: "tug",
    53: "port_tender",
    54: "anti_pollution",
    55: "law_enforcement",
    60: "passenger",
    70: "cargo",
    71: "cargo_hazard_a",
    72: "cargo_hazard_b",
    73: "cargo_hazard_c",
    74: "cargo_hazard_d",
    80: "tanker",
    81: "tanker_hazard_a",
    82: "tanker_hazard_b",
    83: "tanker_hazard_c",
    84: "tanker_hazard_d",
    90: "other"
}
```

---

## Joining Position and Static Data by MMSI

AISStream sends PositionReport and ShipStaticData as separate messages. To get a complete vessel picture, they must be joined by MMSI.

### Join Strategy

1. **During normalization**: Parse all raw messages. For each MMSI:
   - Maintain latest PositionReport (position, speed, course)
   - Maintain latest ShipStaticData (name, type, dimensions)
   - Join by MMSI to produce a complete vessel object

2. **MMSI as join key**: MMSI is globally unique per vessel. Multiple PositionReports from the same MMSI update the same vessel's position.

3. **Partial data handling**: If only PositionReport is received (no ShipStaticData), the vessel still gets a position marker with MMSI as identifier. Name/type will be shown as "MMSI {number}" until static data arrives.

### Join Output: Complete Vessel Position

```python
{
    "source_id": "aisstream",
    "source_family": "ais",
    "mmsi": int,
    "imo": int or None,
    "callsign": str or None,
    "vessel_name": str or None,          # from ShipStaticData
    "vessel_type": str or None,          # from ShipStaticData
    "vessel_type_code": int or None,     # from ShipStaticData
    "latitude": float,
    "longitude": float,
    "speed_over_ground": float,
    "course_over_ground": float,
    "true_heading": int,
    "navigation_status": int,
    "navigation_status_text": str,
    "destination": str or None,          # from ShipStaticData
    "eta": datetime or None,             # from ShipStaticData
    "timestamp_utc": datetime,           # AIS transmission time
    "received_at": datetime,             # when we received it
    "position_accuracy": bool or None,
    "draught": float or None,            # from ShipStaticData
    "dimensions": {                      # from ShipStaticData
        "length": float or None,
        "width": float or None
    },
    "raw_evidence_uri": str,
    "provider_metadata": {
        "position_message_type": str,
        "static_message_type": str,
        "source": "aisstream"
    },
    "dedupe_key": str                    # "{source_id}:{mmsi}" for upsert
}
```

---

## Dedupe / Update Key

The dedupe key for database upsert is:

```
dedupe_key = f"{source_id}:{mmsi}"
```

- **source_id**: Always `"aisstream"` for MVP
- **mmsi**: Unique vessel identifier from AIS

This means:
- Same vessel from same source → upsert (update position, keep latest static data)
- Same MMSI from different sources → separate rows (future multi-source support)

---

## Timestamp Handling

### AIS Timestamp (from message)

- `TimeStamp` field in AIS messages represents when the vessel transmitted the position
- Format may vary (seconds since minute start, or ISO string — verify during fetch proof)
- This is the authoritative position timestamp

### Received Timestamp

- `received_at` is when our system received the message
- Set at message receipt time in the fetcher
- Used for freshness/staleness calculation

### Data Freshness

```
data_age_seconds = now - timestamp_utc
data_age_display = human-readable age (e.g., "2 minutes ago", "stale: 15 minutes")
```

---

## Raw Evidence Reference

Every normalized object includes `raw_evidence_uri` pointing to the raw file:

```
raw/layer_06_maritime/aisstream/2026/06/09/run_20260609T120000Z/raw_messages.jsonl
```

This allows:
- Audit trail from normalized data back to raw AIS messages
- Debugging normalization issues
- Re-normalization from raw data if schema changes

---

## Important Notes

1. **Do not invent fields.** Every field in the normalized schema must be verified against actual AISStream raw messages during fetch proof.
2. **If AISStream fields differ from documentation**, the schema must be adjusted to match reality.
3. **PositionReport does not contain vessel name/type.** These come from ShipStaticData. Position-only records will have MMSI as identifier until static data is received.
4. **ShipStaticData is not sent on every position update.** It is sent periodically (typically every 6 minutes for class A). The normalizer must handle partial data gracefully.
5. **Multiple position reports from the same MMSI** should update the same vessel's latest position, not create duplicates.
