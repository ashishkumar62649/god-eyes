# Fetching Design: Maritime / Live Ships Layer

## Overview

Plan the fetch stage for Layer 06 Maritime. The fetcher connects to AISStream WebSocket, receives real AIS messages, and saves raw data to disk before normalization.

**No database writes during fetch proof. No frontend dependency. No secret leakage.**

---

## AISStream WebSocket Connection Design

### Connection Flow

```
1. Load API key from environment variable (AISSTREAM_API_KEY)
2. Open WebSocket connection to wss://stream.aisstream.io/v0/stream
3. Send subscription message with API key
4. Receive AIS messages in real time
5. Save each raw message to disk (JSONL)
6. Write metadata/summary after run completes
```

### API Key Handling

```python
import os

# Read from environment only — never print, never log, never commit
api_key = os.environ.get("AISSTREAM_API_KEY")
if not api_key:
    raise ValueError("AISSTREAM_API_KEY environment variable not set")
# api_key is used in subscription message only, never stored in raw files
```

- API key is read from `os.environ` at runtime
- API key is NEVER written to raw storage files
- API key is NEVER logged or printed
- API key appears only in the WebSocket subscription message (in memory)

### Subscription Message

```json
{
  "APIKey": "<api_key_from_env>"
}
```

Note: For MVP proof, subscribe to all vessels globally. If free tier requires geographic filtering, add bounding boxes later.

---

## Source Adapter Structure

```
services/fetch-orchestrator/src/layers/layer_06_maritime/
    __init__.py
    aisstream_client.py      # WebSocket connection, message receive loop
    ais_message_parser.py    # Parse raw AIS JSON into structured dict
    maritime_fetcher.py      # Orchestrates fetch run, manages modes
    maritime_raw_storage.py  # Write/read raw messages to disk
```

### aisstream_client.py

Responsibilities:
- Establish WebSocket connection to AISStream
- Send subscription message
- Yield received messages as Python dicts
- Handle connection errors, timeouts, reconnects
- Track connection health metrics (messages received, errors, uptime)

### ais_message_parser.py

Responsibilities:
- Parse raw AIS JSON message
- Extract MessageType (PositionReport, ShipStaticData, etc.)
- Validate message structure
- Return normalized raw dict (without changing field semantics)

### maritime_fetcher.py

Responsibilities:
- Manage run modes (proof, raw capture, continuous)
- Coordinate between client and raw storage
- Track run statistics (message count, duration, vessel count)
- Write metadata/summary after run

### maritime_raw_storage.py

Responsibilities:
- Create dated run directory
- Write raw messages to JSONL file
- Write run metadata (start time, end time, message count, source)
- Read raw messages back for normalization (later)

---

## Run Modes

### 1. Proof Mode

**Purpose**: Prove AISStream connection works and data is real.

```
Duration: 60 seconds OR 100 messages (whichever comes first)
Output: raw_messages.jsonl + metadata.json + preview.json
Database writes: NONE
Frontend dependency: NONE
```

Proof mode:
- Connects to AISStream
- Receives messages for up to 60 seconds
- Stops after 100 messages received (or 60s timeout)
- Saves raw messages to disk
- Prints summary: message count, unique vessels, message types observed
- Does NOT normalize
- Does NOT write to database
- Does NOT connect to API or frontend

### 2. Download-Only / Raw Capture Mode

**Purpose**: Capture raw AIS data for longer periods.

```
Duration: Configurable (default 300 seconds / 5 minutes)
Output: raw_messages.jsonl + metadata.json
Database writes: NONE
Frontend dependency: NONE
```

Raw capture mode:
- Same as proof mode but longer duration
- Designed for capturing larger datasets for normalization testing
- May be limited by free tier rate limits

### 3. Normalize-from-Cache Mode

**Purpose**: Normalize previously captured raw data.

```
Input: raw_messages.jsonl from proof or capture run
Output: normalized vessel/position objects (JSONL)
Database writes: NONE (output to normalized cache file)
Frontend dependency: NONE
```

Normalize-from-cache:
- Reads raw_messages.jsonl from a completed fetch run
- Parses PositionReport and ShipStaticData messages
- Joins static data by MMSI
- Writes normalized objects to a separate file
- Ready for database ingestion

### 4. Continuous Mode (Later)

**Purpose**: Ongoing live AIS data collection.

```
Duration: Indefinite (until stopped)
Output: Periodic raw files + database upserts
Database writes: YES (after normalization)
Frontend dependency: NONE
```

Continuous mode:
- Runs persistently
- Saves raw data in time-bucketed directories
- Normalizes and upserts to database on schedule
- Handles reconnection on drops
- Reports health metrics

---

## Proof Duration Recommendation

**Recommended: 60 seconds OR 100 messages (whichever comes first)**

Rationale:
- 60 seconds is enough to confirm real data is flowing
- 100 messages is enough to inspect message variety
- Short duration avoids rate limit concerns on free tier
- Enough data to verify field structure and message types
- Can be re-run easily if connection fails

---

## Rate / Reconnect Handling

### Reconnection Strategy

```python
RECONNECT_DELAYS = [1, 2, 5, 10, 30]  # seconds, exponential-ish backoff

async def connect_with_reconnect():
    for attempt in range(len(RECONNECT_DELAYS)):
        try:
            async with websockets.connect(WS_URL) as ws:
                await subscribe(ws)
                async for msg in ws:
                    yield msg
            # Connection closed normally — stop
            break
        except (ConnectionClosed, ConnectionError) as e:
            delay = RECONNECT_DELAYS[min(attempt, len(RECONNECT_DELAYS)-1)]
            log(f"Connection lost, reconnecting in {delay}s: {e}")
            await asyncio.sleep(delay)
```

### Heartbeat / Timeout

- AISStream may send ping/pong frames; let WebSocket library handle them
- If no messages received for 30 seconds, log warning
- If no messages received for 120 seconds, consider connection dead and reconnect
- Track last_message_received_at timestamp

---

## Source Health Metrics

Track during each run:

| Metric | Description |
|--------|-------------|
| `connection_started_at` | When WebSocket connected |
| `connection_ended_at` | When WebSocket disconnected |
| `total_messages_received` | Total raw messages received |
| `position_messages_received` | Count of PositionReport messages |
| `static_messages_received` | Count of ShipStaticData messages |
| `other_messages_received` | Count of other message types |
| `unique_mmsi_count` | Distinct MMSI values seen |
| `errors` | List of error events |
| `reconnect_count` | Number of reconnections |
| `run_duration_seconds` | Total run time |
| `messages_per_second` | Average message rate |

---

## Raw Storage Folder Structure

Following the project convention in `DATA_LOCATION_RULES.md`:

```
raw/layer_06_maritime/aisstream/{yyyy}/{mm}/{dd}/run_{timestamp}/
    raw_messages.jsonl       # One JSON object per line
    metadata.json            # Run metadata and health metrics
    preview.json             # First 10 messages for quick inspection
```

### Example

```
raw/layer_06_maritime/aisstream/2026/06/09/run_20260609T120000Z/
    raw_messages.jsonl       # 100 AIS messages
    metadata.json            # Run summary
    preview.json             # First 10 messages
```

### raw_messages.jsonl Format

Each line is a JSON object:

```json
{"received_at": "2026-06-09T12:00:01Z", "MessageType": "PositionReport", "Message": {"UserID": 123456789, "Latitude": 37.7749, "Longitude": -122.4194, "Speed": 12.5, "Course": 180.0, "Heading": 178, "NavigationalStatus": 0, "TimeStamp": "2026-06-09T12:00:00Z"}}
{"received_at": "2026-06-09T12:00:02Z", "MessageType": "ShipStaticData", "Message": {"UserID": 123456789, "Imo": 9876543, "CallSign": "ABCD", "Name": "CARGO SHIP ONE", "ShipType": 70, "Length": 200, "Width": 30, "Destination": "USLAX", "Eta": "2026-06-12T08:00:00Z", "Draught": 12.5}}
```

Note: The API key does NOT appear in raw_messages.jsonl. The subscription message (containing the API key) is sent once at connection time and is not stored.

### metadata.json Format

```json
{
  "source_id": "aisstream",
  "layer_id": "layer_06_maritime",
  "run_id": "run_20260609T120000Z",
  "run_mode": "proof",
  "started_at": "2026-06-09T12:00:00Z",
  "ended_at": "2026-06-09T12:01:00Z",
  "duration_seconds": 60,
  "total_messages": 100,
  "position_messages": 85,
  "static_messages": 10,
  "other_messages": 5,
  "unique_mmsi": 72,
  "reconnect_count": 0,
  "errors": [],
  "messages_per_second": 1.67,
  "api_key_used": true,
  "api_key_value": null
}
```

Note: `api_key_value` is always null in stored metadata. Never persist secrets.

### preview.json Format

```json
{
  "source_id": "aisstream",
  "layer_id": "layer_06_maritime",
  "run_id": "run_20260609T120000Z",
  "preview_count": 10,
  "messages": [
    { "received_at": "...", "MessageType": "PositionReport", "Message": { ... } },
    ...
  ]
}
```

---

## No Database Writes in Fetching Proof

During proof and raw capture modes:
- Fetcher writes ONLY to `raw/` directory
- No database connection is opened
- No normalization is performed
- No API endpoints are called
- No frontend components are affected

This ensures:
- Fetching can be validated independently
- Raw data is preserved before any processing
- Secrets are never near database code during proof

---

## No Frontend Dependency

The fetching stage is completely decoupled from the frontend:
- No WebSocket/SSE connection to frontend
- No Cesium rendering dependency
- No API contract dependency
- Fetcher runs as a standalone CLI tool

---

## No Secret Leakage

Guarantees:
1. API key is read from environment variable only
2. API key is used only in WebSocket subscription message (in memory)
3. API key is NEVER written to raw storage files
4. API key is NEVER logged or printed
5. API key is NEVER included in metadata.json
6. Raw messages do not contain the API key (it's sent once at connection, not per-message)
