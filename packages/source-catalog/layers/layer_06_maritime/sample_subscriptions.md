# AISStream Sample Subscriptions

**WO-MAR-R** — Maritime Source Research

---

## 1. Global Subscription (All Vessels Worldwide)

```json
{
  "APIKey": "<AISSTREAM_API_KEY>",
  "BoundingBoxes": [[[-90, -180], [90, 180]]]
}
```

**Notes**:
- BoundingBoxes is REQUIRED per AISStream docs
- Global subscription = full lat/lon range
- Expect ~300 messages/second
- May exceed free tier — verify during WO-MAR-S

---

## 2. Regional Subscription (Single Bounding Box)

```json
{
  "APIKey": "<AISSTREAM_API_KEY>",
  "BoundingBoxes": [[[25.835302, -80.207729], [25.602700, -79.879297]]]
}
```

**Notes**:
- Port of Miami area
- Two corners: [lat, lon] for each corner
- Coordinate order: [latitude, longitude]

---

## 3. Multiple Regions Subscription

```json
{
  "APIKey": "<AISSTREAM_API_KEY>",
  "BoundingBoxes": [
    [[25.835302, -80.207729], [25.602700, -79.879297]],
    [[33.772292, -118.356139], [33.673490, -118.095731]]
  ]
}
```

**Notes**:
- Port of Miami + Port of Los Angeles
- Multiple bounding boxes in one subscription
- No data duplication across overlapping boxes

---

## 4. MMSI Filter (Specific Vessels Only)

```json
{
  "APIKey": "<AISSTREAM_API_KEY>",
  "BoundingBoxes": [[[-90, -180], [90, 180]]],
  "FiltersShipMMSI": ["368207620", "367719770", "211476060"]
}
```

**Notes**:
- Maximum 50 MMSI values per filter
- MMSI values are strings in the filter
- Still requires BoundingBoxes

---

## 5. Message Type Filter (Position Reports Only)

```json
{
  "APIKey": "<AISSTREAM_API_KEY>",
  "BoundingBoxes": [[[-90, -180], [90, 180]]],
  "FilterMessageTypes": ["PositionReport"]
}
```

**Notes**:
- Filter to specific message types
- Reduces message volume
- Useful for the current build to focus on positions only

---

## 6. Current-Build Proof Subscription (Recommended for WO-MAR-S)

```json
{
  "APIKey": "<AISSTREAM_API_KEY>",
  "BoundingBoxes": [[[-90, -180], [90, 180]]],
  "FilterMessageTypes": ["PositionReport", "ShipStaticData"]
}
```

**Notes**:
- Subscribe to PositionReport and ShipStaticData only
- Reduces noise from other message types
- Still global coverage
- Good balance for initial fetch proof

---

## 7. Subscription Update (Replace Existing)

```json
{
  "APIKey": "<AISSTREAM_API_KEY>",
  "BoundingBoxes": [[[35.0, -120.0], [40.0, -115.0]]]
}
```

**Notes**:
- Send on existing WebSocket connection
- Replaces previous subscription (not merged)
- Max 1 update per second

---

## Subscription Rules

1. **BoundingBoxes**: Always required, even for global
2. **Coordinate order**: `[latitude, longitude]` for each corner
3. **Timeout**: Subscription must be sent within 3 seconds of connection
4. **Update**: Re-sending subscription message replaces previous (not merge)
5. **Throttle**: Max 1 subscription update per second
6. **MMSI filter**: Max 50 values, string format
7. **Message type filter**: Valid message type names, no duplicates

---

**Created by**: Fetching Worker (WO-MAR-R)
**Date**: 2026-06-09
