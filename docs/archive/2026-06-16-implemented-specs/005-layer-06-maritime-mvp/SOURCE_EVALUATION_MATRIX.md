# Source Evaluation Matrix: Maritime / Live Ships Layer

## Purpose

Evaluate AIS/maritime data sources for the GOD EYES Maritime layer. The MVP requires a free, globally-capable source of real vessel position data.

---

## Primary MVP Source: AISStream

### Overview

| Property | Value |
|----------|-------|
| **Official Website** | https://aisstream.io/ |
| **Docs URL** | https://aisstream.io/documentation |
| **Source Type** | WebSocket (real-time AIS messages) |
| **Free Tier** | Yes — free API key with usage limits |
| **Paid Tier** | Yes — paid plans for higher throughput (not needed for MVP) |
| **API Key Required** | Yes (already stored in local `.env`, must not be read/printed during planning) |
| **Coverage** | Global (AIS receivers worldwide feed into AISStream network) |
| **Real-Time or Delayed** | Real-time (messages arrive as ships transmit) |
| **Refresh Behavior** | Continuous WebSocket stream; messages arrive as transmitted by vessels |
| **Rate Limits** | Free tier: limited message rate (exact limits TBD during fetch proof) |
| **License/Terms** | AISStream Terms of Service; data is aggregated from public AIS receivers |
| **Bot/Access Risk** | Low for WebSocket connection; must maintain stable connection |
| **Data Fields Available** | PositionReport: MMSI, latitude, longitude, speed, course, heading, navigation status, timestamp. ShipStaticData: MMSI, IMO, callsign, vessel name, vessel type, dimensions, destination, ETA, draught |
| **Coordinates Available** | Yes — lat/lon per position report |
| **Vessel Identity Fields** | MMSI (primary), IMO (if ShipStaticData received), callsign, vessel name |
| **Timestamp Fields** | Message timestamp (time of receipt), AIS timestamp (time of transmission) |
| **Navigation/Course Fields** | speed_over_ground, course_over_ground, true_heading, navigation_status |
| **Supports Live Globe Markers** | Yes — real-time positions with heading |
| **Supports All Vessels** | Yes — all AIS-equipped vessels (cargo, tanker, passenger, fishing, tug, etc.) |
| **MVP Decision** | **PRIMARY_MVP_SOURCE** |

### AISStream Message Types (Expected)

1. **PositionReport (Type 1/2/3)** — Vessel position with coordinates, speed, course
2. **ShipStaticData (Type 5)** — Vessel identity, type, dimensions, destination, ETA
3. **StandardClassBCSPositionReport (Type 18)** — Class B transponder positions
4. **LongRangeIntervalMessage (Type 27)** — Long-range positions (ocean passages)

### AISStream WebSocket Connection Shape (Plan)

```json
// Subscribe message (client → server):
{
  "APIKey": "<api_key>",
  "BoundingBoxes": [[[lat_min, lon_min], [lat_max, lon_max]]]
}

// Or subscribe to all:
{
  "APIKey": "<api_key>"
}

// Received messages (server → client):
{
  "MessageType": "PositionReport",
  "Message": {
    "UserID": 123456789,
    "Latitude": 37.7749,
    "Longitude": -122.4194,
    "Speed": 12.5,
    "Course": 180.0,
    "Heading": 178,
    "NavigationalStatus": 0,
    "TimeStamp": "2026-06-09T12:00:00Z"
  }
}
```

### Risks

- Free tier message rate may be limited (unknown exact cap until fetch proof)
- WebSocket connection may drop; needs reconnect logic
- Global subscription may exceed free tier limits; may need geographic filtering
- ShipStaticData may not arrive for every vessel (only on schedule or request)
- IMO field may be absent in some messages
- Data fields may differ slightly from documentation (must verify during fetch proof)

### Sample Request/Subscription Shape

```python
import websockets
import json

async def connect_aisstream():
    async with websockets.connect("wss://stream.aisstream.io/v0/stream") as ws:
        subscribe = {"APIKey": os.environ["AISSTREAM_API_KEY"]}
        await ws.send(json.dumps(subscribe))
        async for message in ws:
            data = json.loads(message)
            # Process PositionReport / ShipStaticData
            print(data)
```

---

## Secondary / Future Sources

### BarentsWatch Live AIS

| Property | Value |
|----------|-------|
| **Official Website** | https://www.barentswatch.no/ |
| **Docs URL** | https://www.barentswatch.no/en/geoservices/ |
| **Source Type** | REST API (JSON) |
| **Free Tier** | Yes (public data, registration required) |
| **API Key Required** | Yes (API token) |
| **Coverage** | Regional (Norway / Barents Sea area) |
| **Real-Time or Delayed** | Near real-time |
| **Refresh Behavior** | Periodic polling (every few minutes) |
| **Rate Limits** | Unknown until tested |
| **License/Terms** | Norwegian government open data; attribution required |
| **Data Fields** | MMSI, vessel name, position, speed, course, heading, vessel type |
| **Supports Live Globe Markers** | Yes (regional only) |
| **Supports All Vessels** | Regional — Norwegian waters only |
| **MVP Decision** | **BACKUP_SOURCE** (regional fallback if AISStream fails; not global) |
| **Risks** | Regional coverage only; Norwegian waters; not suitable as sole global source |
| **Sample Request** | `GET https://live.ais.barentswatch.no/v1/track?mmsi=...` |

### Danish Maritime Authority AIS Historical Downloads

| Property | Value |
|----------|-------|
| **Official Website** | https://www.dma.dk/ |
| **Docs URL** | https://www.dma.dk/AISData |
| **Source Type** | Bulk download (historical AIS data files) |
| **Free Tier** | Yes (historical data, registration required) |
| **API Key Required** | No (download account) |
| **Coverage** | Regional (Danish waters) + some global historical |
| **Real-Time or Delayed** | Historical only (not live) |
| **Refresh Behavior** | Periodic bulk file releases |
| **License/Terms** | Danish government data; terms vary |
| **Data Fields** | Full AIS messages including position, static, voyage |
| **Supports Live Globe Markers** | No — historical only |
| **Supports All Vessels** | Historical vessel movements |
| **MVP Decision** | **FUTURE_ANALYSIS_SOURCE** (historical replay, not live) |
| **Risks** | Not real-time; regional; bulk download only |
| **Sample Request** | Download CSV/JSON files from DMA portal |

### NOAA AccessAIS Historical Data

| Property | Value |
|----------|-------|
| **Official Website** | https://www.noaa.gov/ |
| **Docs URL** | https://coastwatch.pfeg.noaa.gov/ |
| **Source Type** | Dataset download (historical AIS) |
| **Free Tier** | Yes |
| **API Key Required** | No |
| **Coverage** | US waters (primarily) |
| **Real-Time or Delayed** | Historical only |
| **Refresh Behavior** | Static dataset |
| **License/Terms** | US government public domain |
| **Data Fields** | AIS position and static data |
| **Supports Live Globe Markers** | No — historical |
| **Supports All Vessels** | US waters historical |
| **MVP Decision** | **FUTURE_ANALYSIS_SOURCE** (historical analysis) |
| **Risks** | Not real-time; US-only; historical |
| **Sample Request** | Download from NOAA data portals |

### Global Fishing Watch Delayed AIS

| Property | Value |
|----------|-------|
| **Official Website** | https://globalfishingwatch.org/ |
| **Docs URL** | https://globalfishingwatch.org/api-documentation/ |
| **Source Type** | REST API / dataset |
| **Free Tier** | Yes (public API with rate limits) |
| **API Key Required** | Yes (API key) |
| **Coverage** | Global |
| **Real-Time or Delayed** | Delayed (5+ days) |
| **Refresh Behavior** | Periodic dataset updates |
| **License/Terms** | Creative Commons; attribution required |
| **Data Fields** | Vessel position, fishing activity, vessel identity |
| **Supports Live Globe Markers** | No — delayed only |
| **Supports All Vessels** | Focus on fishing vessels |
| **MVP Decision** | **FUTURE_ANALYSIS_SOURCE** (fishing analytics, delayed) |
| **Risks** | Delayed data; fishing-vessel focus; not suitable for live ship tracking |
| **Sample Request** | `GET https://globalfishingwatch.org/api/v1/vessels?...` |

### MarineTraffic (Mentioned in Registry)

| Property | Value |
|----------|-------|
| **Official Website** | https://www.marinetraffic.com/ |
| **Source Type** | Proprietary AIS aggregation |
| **Free Tier** | Limited (website only, no free API) |
| **Paid Tier** | Yes — API requires paid subscription |
| **API Key Required** | Yes (paid) |
| **Coverage** | Global |
| **Real-Time or Delayed** | Real-time (paid), delayed (free website) |
| **MVP Decision** | **REJECT_FOR_MVP** (paid API required) |
| **Risks** | Commercial; paid API only; terms may restrict reuse |

### AISHub (Mentioned in Registry)

| Property | Value |
|----------|-------|
| **Official Website** | https://www.aishub.net/ |
| **Source Type** | REST API (crowdsourced AIS data) |
| **Free Tier** | Yes (requires contributing AIS data) |
| **API Key Required** | Yes |
| **Coverage** | Global (depends on contributors) |
| **Real-Time or Delayed** | Near real-time |
| **MVP Decision** | **BACKUP_SOURCE** (requires data contribution; may not be available without hardware) |
| **Risks** | Requires contributing AIS data to access API; coverage varies by region |

---

## Source Decision Summary

| Source | MVP Role | Reason |
|--------|----------|--------|
| **AISStream** | PRIMARY_MVP_SOURCE | Free API key, WebSocket real-time, global coverage, well-documented |
| BarentsWatch | BACKUP_SOURCE | Regional fallback (Norway); not global enough for MVP |
| AISHub | BACKUP_SOURCE | Requires data contribution; uncertain availability |
| Danish Maritime Authority | FUTURE_ANALYSIS_SOURCE | Historical only; not live |
| NOAA AccessAIS | FUTURE_ANALYSIS_SOURCE | Historical only; US-only |
| Global Fishing Watch | FUTURE_ANALYSIS_SOURCE | Delayed; fishing-vessel focus |
| MarineTraffic | REJECT_FOR_MVP | Paid API required |

---

## Key Unknowns (To Resolve in Fetch Proof)

1. Exact free-tier rate limit for AISStream
2. Whether global subscription (all vessels worldwide) is feasible on free tier
3. Exact JSON message shape for PositionReport and ShipStaticData
4. Whether ShipStaticData is reliably received for all vessels
5. Whether geographic bounding box filtering is required to stay within limits
6. Connection stability and reconnect behavior
7. Latency between AIS transmission and AISStream delivery

---

**Status**: Evaluation complete for planning. Real validation pending fetch proof (WO-MAR-S).
