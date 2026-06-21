# AISStream Message Field Mapping

**WO-MAR-R** — Maritime Source Research

---

## AISStream Message Envelope

Every message from AISStream has this structure:

```json
{
  "MessageType": "<Message Type>",
  "Metadata": {
    "MMSI": 259000420,
    "ShipName": "AUGUSTSON",
    "latitude": 66.02695,
    "longitude": 12.253821666666665,
    "time_utc": "2022-12-29 18:22:32.318353 +0000 UTC"
  },
  "Message": {
    "<Message Type>": { <AIS Message Body> }
  }
}
```

---

## PositionReport (AIS Message Types 1, 2, 3)

Standard class A position reports.

### Field Mapping

| AISStream Field | Type | Our Normalized Field | Notes |
|-----------------|------|---------------------|-------|
| `MessageID` | integer | `ais_message_type` | 1, 2, or 3 |
| `RepeatIndicator` | integer | — | Not used in current build |
| `UserID` | integer | `mmsi` | **Primary vessel identifier** |
| `Valid` | boolean | — | Validation flag |
| `NavigationalStatus` | integer | `navigation_status` | 0-15, see code map below |
| `RateOfTurn` | integer | — | Not used in current build |
| `Sog` | double | `speed_over_ground` | **Knots** |
| `PositionAccuracy` | boolean | `position_accuracy` | |
| `Longitude` | double | `longitude` | **Degrees, E positive** |
| `Latitude` | double | `latitude` | **Degrees, N positive** |
| `Cog` | double | `course_over_ground` | **Degrees** |
| `TrueHeading` | integer | `true_heading` | **0-359, 511 = not available** |
| `Timestamp` | integer | `timestamp` | **Seconds since minute start** (0-59) |
| `SpecialManoeuvreIndicator` | integer | — | Not used in current build |
| `Spare` | integer | — | Reserved |
| `Raim` | boolean | — | Not used in current build |
| `CommunicationState` | integer | — | Not used in current build |

### Timestamp Interpretation

| Value | Meaning |
|-------|---------|
| 0-59 | Seconds since minute start |
| 60 | Not available (default) |
| 61 | Manual input mode |
| 62 | Dead reckoning mode |
| 63 | Inoperative |

---

## ShipStaticData (AIS Message Type 5)

Static vessel information. Sent periodically (typically every 6 minutes for class A).

### Field Mapping

| AISStream Field | Type | Our Normalized Field | Notes |
|-----------------|------|---------------------|-------|
| `MessageID` | integer | `ais_message_type` | 5 |
| `RepeatIndicator` | integer | — | Not used in current build |
| `UserID` | integer | `mmsi` | **Primary vessel identifier** |
| `Valid` | boolean | — | Validation flag |
| `AisVersion` | integer | — | Not used in current build |
| `ImoNumber` | integer | `imo` | **IMO number (may be 0)** |
| `CallSign` | string | `callsign` | **Vessel callsign** |
| `Name` | string | `vessel_name` | **Vessel name** |
| `Type` | integer | `vessel_type_code` | **AIS ship type code** |
| `Dimension.A` | integer | `bow_to_antenna` | Bow to mast/antenna (meters) |
| `Dimension.B` | integer | `stern_to_antenna` | Stern to mast/antenna (meters) |
| `Dimension.C` | integer | `port_to_center` | Port to centerline (meters) |
| `Dimension.D` | integer | `starboard_to_center` | Starboard to centerline (meters) |
| `FixType` | integer | — | Not used in current build |
| `Eta.Day` | integer | `eta_day` | ETA day |
| `Eta.Hour` | integer | `eta_hour` | ETA hour |
| `Eta.Minute` | integer | `eta_minute` | ETA minute |
| `Eta.Month` | integer | `eta_month` | ETA month |
| `MaximumStaticDraught` | double | `draught` | **Meters** |
| `Destination` | string | `destination` | **Destination port** |
| `Dte` | boolean | — | Not used in current build |
| `Spare` | boolean | — | Reserved |

### Dimension Computation

```python
length_meters = Dimension.A + Dimension.B  # bow + stern
width_meters = Dimension.C + Dimension.D   # port + starboard
```

### ETA Reconstruction

```python
# AISStream ETA is {Day, Hour, Minute, Month} — no year
# Must reconstruct ISO datetime:
eta = f"{current_year}-{eta.Month:02d}-{eta.Day:02d}T{eta.Hour:02d}:{eta.Minute:02d}:00Z"
# Note: Year is not in ETA; must use current year or infer
```

---

## StandardClassBPositionReport (AIS Message Type 18)

Class B transponder positions (smaller vessels, recreational).

### Field Mapping

| AISStream Field | Type | Our Normalized Field | Notes |
|-----------------|------|---------------------|-------|
| `MessageID` | integer | `ais_message_type` | 18 |
| `RepeatIndicator` | integer | — | Not used |
| `UserID` | integer | `mmsi` | **MMSI** |
| `Valid` | boolean | — | Validation flag |
| `Sog` | double | `speed_over_ground` | **Knots** |
| `PositionAccuracy` | boolean | `position_accuracy` | |
| `Longitude` | double | `longitude` | **Degrees** |
| `Latitude` | double | `latitude` | **Degrees** |
| `Cog` | double | `course_over_ground` | **Degrees** |
| `TrueHeading` | integer | `true_heading` | **0-359, 511 = N/A** |
| `Timestamp` | integer | `timestamp` | **Seconds since minute start** |
| `ClassBUnit` | boolean | — | Not used |
| `ClassBDisplay` | boolean | — | Not used |
| `ClassBDsc` | boolean | — | Not used |
| `ClassBBand` | boolean | — | Not used |
| `ClassBMsg22` | boolean | — | Not used |
| `AssignedMode` | boolean | — | Not used |
| `Raim` | boolean | — | Not used |
| `CommunicationStateIsItdma` | boolean | — | Not used |
| `CommunicationState` | integer | — | Not used |

---

## ExtendedClassBPositionReport (AIS Message Type 19)

Extended class B position with vessel name and type.

### Field Mapping

| AISStream Field | Type | Our Normalized Field | Notes |
|-----------------|------|---------------------|-------|
| `MessageID` | integer | `ais_message_type` | 19 |
| `UserID` | integer | `mmsi` | **MMSI** |
| `Sog` | double | `speed_over_ground` | **Knots** |
| `Longitude` | double | `longitude` | **Degrees** |
| `Latitude` | double | `latitude` | **Degrees** |
| `Cog` | double | `course_over_ground` | **Degrees** |
| `TrueHeading` | integer | `true_heading` | **0-359** |
| `Timestamp` | integer | `timestamp` | **Seconds since minute start** |
| `Name` | string | `vessel_name` | **Vessel name (if available)** |
| `Type` | integer | `vessel_type_code` | **AIS ship type code** |
| `Dimension.A` | integer | `bow_to_antenna` | Meters |
| `Dimension.B` | integer | `stern_to_antenna` | Meters |
| `Dimension.C` | integer | `port_to_center` | Meters |
| `Dimension.D` | integer | `starboard_to_center` | Meters |

---

## LongRangeAisBroadcastMessage (AIS Message Type 27)

Long-range position broadcasts for ocean passages (lower accuracy).

### Field Mapping

| AISStream Field | Type | Our Normalized Field | Notes |
|-----------------|------|---------------------|-------|
| `MessageID` | integer | `ais_message_type` | 27 |
| `UserID` | integer | `mmsi` | **MMSI** |
| `PositionAccuracy` | boolean | `position_accuracy` | |
| `Raim` | boolean | — | Not used |
| `NavigationalStatus` | integer | `navigation_status` | **0-15** |
| `Longitude` | double | `longitude` | **Degrees (lower precision)** |
| `Latitude` | double | `latitude` | **Degrees (lower precision)** |
| `Sog` | double | `speed_over_ground` | **Knots** |
| `Cog` | double | `course_over_ground` | **Degrees** |
| `PositionLatency` | boolean | — | Not used |

---

## Navigation Status Codes

| Code | Status |
|------|--------|
| 0 | under_way_using_engine |
| 1 | at_anchor |
| 2 | not_under_command |
| 3 | restricted_manoeuvrability |
| 4 | constrained_by_draft |
| 5 | moored |
| 6 | aground |
| 7 | engaged_in_fishing |
| 8 | under_way_sailing |
| 9 | reserved_for_hsc |
| 10 | reserved_for_wig |
| 11 | power_driven_vessel_towing_astern |
| 12 | power_driven_vessel_pushing_ahead |
| 13 | reserved |
| 14 | ais_sart |
| 15 | not_defined |

---

## Ship Type Code Mapping (AIS Type 5)

| Code Range | Category |
|------------|----------|
| 0 | not_available |
| 20-29 | wing_in_ground |
| 30-39 | fishing, towing, dredging, diving, military, sailing, pleasure |
| 40-49 | hsc (high speed craft) |
| 50-59 | pilot, SAR, tug, port_tender, anti_pollution, law_enforcement |
| 60-69 | passenger |
| 70-79 | cargo (including hazard classes A-D) |
| 80-89 | tanker (including hazard classes A-D) |
| 90-99 | other |

---

## Key Mapping Decisions

1. **`Sog` → `speed_over_ground`**: Field name difference from planning
2. **`Cog` → `course_over_ground`**: Field name difference from planning
3. **`Timestamp` (int) → parse as seconds-since-minute**: Not ISO string
4. **`Dimension.A+B` → `length_meters`**: Must compute total length
5. **`Dimension.C+D` → `width_meters`**: Must compute total width
6. **`Eta` object → ISO string**: Must reconstruct, year unknown
7. **Metadata object**: Provides quick access to MMSI, ShipName, lat/lon

---

**Created by**: Fetching Worker (WO-MAR-R)
**Date**: 2026-06-09
