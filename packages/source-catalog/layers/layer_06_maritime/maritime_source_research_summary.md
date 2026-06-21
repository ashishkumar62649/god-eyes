# Maritime Source Research Summary

**Work Order**: WO-MAR-R
**Agent**: Fetching Worker
**Date**: 2026-06-09
**Status**: Complete

---

## AISStream — PRIMARY CURRENT-BUILD SOURCE

### Verification Status: VERIFIED

All critical details confirmed against AISStream official documentation at https://aisstream.io/documentation.

### Connection Details

| Property | Verified Value |
|----------|----------------|
| **WebSocket Endpoint** | `wss://stream.aisstream.io/v0/stream` |
| **Protocol** | WSS (WebSocket Secure) |
| **Authentication** | API key required |
| **Env Var Name** | `AISSTREAM_API_KEY` |
| **Free Tier** | Yes (with rate limits) |
| **Coverage** | Global (AIS receivers worldwide) |
| **Real-Time** | Yes (messages arrive as transmitted) |

### Subscription Shape

```json
{
  "APIKey": "<api_key>",
  "BoundingBoxes": [[[lat1, lon1], [lat2, lon2]]],
  "FiltersShipMMSI": ["368207620"],  // Optional
  "FilterMessageTypes": ["PositionReport"]  // Optional
}
```

**Critical Finding**: `BoundingBoxes` is **REQUIRED** in the documentation. Global subscription is achieved via `[[-90, -180], [90, 180]]`.

### Message Format

Every AISStream message wraps the actual AIS data in a standard envelope:

```json
{
  "MessageType": "PositionReport",
  "Metadata": {
    "MMSI": 259000420,
    "ShipName": "AUGUSTSON",
    "latitude": 66.02695,
    "longitude": 12.253821666666665,
    "time_utc": "2022-12-29 18:22:32.318353 +0000 UTC"
  },
  "Message": {
    "PositionReport": { ... }
  }
}
```

### Key Field Mapping

#### PositionReport (Types 1, 2, 3)

| AISStream Field | Our Field | Type | Notes |
|-----------------|-----------|------|-------|
| `UserID` | `mmsi` | int | Primary vessel identifier |
| `Latitude` | `latitude` | float | Degrees, N positive |
| `Longitude` | `longitude` | float | Degrees, E positive |
| `Sog` | `speed_over_ground` | float | Knots |
| `Cog` | `course_over_ground` | float | Degrees |
| `TrueHeading` | `true_heading` | int | 0-359, 511 = not available |
| `NavigationalStatus` | `navigation_status` | int | 0-15 |
| `Timestamp` | `timestamp` | **int** | **Seconds since minute start** (NOT ISO string!) |
| `PositionAccuracy` | `position_accuracy` | bool | |

#### ShipStaticData (Type 5)

| AISStream Field | Our Field | Type | Notes |
|-----------------|-----------|------|-------|
| `UserID` | `mmsi` | int | Primary identifier |
| `ImoNumber` | `imo` | int | May be 0 if not available |
| `CallSign` | `callsign` | string | |
| `Name` | `vessel_name` | string | |
| `Type` | `vessel_type_code` | int | AIS ship type code |
| `Dimension.A` | `bow_to_antenna` | int | Meters |
| `Dimension.B` | `stern_to_antenna` | int | Meters |
| `Dimension.C` | `port_to_center` | int | Meters |
| `Dimension.D` | `starboard_to_center` | int | Meters |
| `Eta` | `eta` | object | `{Day, Hour, Minute, Month}` |
| `MaximumStaticDraught` | `draught` | float | Meters |
| `Destination` | `destination` | string | |

### Discrepancies from Planning

| # | Planning Assumption | Actual (Verified) | Impact |
|---|---------------------|-------------------|--------|
| 1 | `BoundingBoxes` optional | **Required** in docs | Must always include bbox in subscription |
| 2 | Global subscription via no bbox | Global via `[[-90,-180],[90,180]]` | Works, but bbox is mandatory |
| 3 | `TimeStamp` as ISO string | **Integer** (seconds since minute start) | Must parse differently |
| 4 | `Dimension` as length/width | **A/B/C/D** format | Must compute length/width from A+B and C+D |
| 5 | `Eta` as ISO string | **Object** `{Day, Hour, Minute, Month}` | Must reconstruct ISO datetime |
| 6 | `Speed` field name | **`Sog`** field name | Must map `Sog` → `speed_over_ground` |
| 7 | `Course` field name | **`Cog`** field name | Must map `Cog` → `course_over_ground` |
| 8 | Metadata included | **Metadata object** with MMSI, ShipName, lat/lon, time_utc | Use for quick access |

### Rate Limits / Constraints

- Free tier: ~300 messages/second (global subscription)
- Subscription timeout: 3 seconds (must send subscription within 3s of connection)
- Subscription update throttle: max 1 per second
- MMSI filter max: 50 values
- API models may change without notice (BETA)

### Risks for the current build

1. **BETA service** — no SLA, no uptime guarantee
2. **Unstable API** — object models may change without notice
3. **Rate limits** — free tier limit not precisely documented
4. **Subscription timeout** — 3 second window to send subscription
5. **ShipStaticData not guaranteed** — sent periodically, not on every position
6. **Connection drops** — no explicit reconnect documentation
7. **Global subscription volume** — ~300 msg/s may overwhelm free tier

### Decision

**READY_FOR_FETCH_PROOF**

AISStream is suitable for WO-MAR-S fetch proof. The connection shape, message types, and field names are now verified. Discrepancies from planning have been documented and will be handled in the normalizer.

---

## Secondary Sources

### BarentsWatch Live AIS

| Property | Value |
|----------|-------|
| **Website** | https://www.barentswatch.no/ |
| **Docs** | https://www.barentswatch.no/en/geoservices/ (returned 404) |
| **Type** | REST API |
| **Coverage** | Regional (Norway) |
| **Decision** | **FUTURE_SOURCE** — Regional fallback only; not global enough for the current build |

### AISHub

| Property | Value |
|----------|-------|
| **Website** | https://www.aishub.net/ |
| **Docs** | https://www.aishub.net/api |
| **Type** | REST API (JSON/XML/CSV) |
| **Coverage** | Global (crowdsourced, depends on contributors) |
| **Requirement** | Must contribute AIS data to access API |
| **Decision** | **FUTURE_SOURCE** — Requires hardware/data contribution; uncertain availability |

### Danish Maritime Authority

| Property | Value |
|----------|-------|
| **Website** | https://www.dma.dk/ |
| **Type** | Bulk download (historical) |
| **Coverage** | Regional (Danish waters) |
| **Decision** | **FUTURE_ANALYSIS_SOURCE** — Historical only, not live |

### NOAA AccessAIS

| Property | Value |
|----------|-------|
| **Website** | https://www.noaa.gov/ |
| **Type** | Dataset download (historical) |
| **Coverage** | US waters (primarily) |
| **Decision** | **FUTURE_ANALYSIS_SOURCE** — Historical only, not live |

### Global Fishing Watch

| Property | Value |
|----------|-------|
| **Website** | https://globalfishingwatch.org/ |
| **Docs** | https://globalfishingwatch.org/api-documentation/ |
| **Type** | REST API / dataset |
| **Coverage** | Global |
| **Latency** | Delayed (5+ days) |
| **Decision** | **FUTURE_ANALYSIS_SOURCE** — Delayed, fishing-vessel focus |

---

**Created by**: Fetching Worker (WO-MAR-R)
**Date**: 2026-06-09
