# Frontend Planning: Maritime / Live Ships Layer

## Overview

Plan the frontend (Cesium) layer for Layer 06 Maritime. Renders real vessel positions as ship markers on the globe with heading direction, click-to-detail card, and source attribution.

---

## Layer Toggle

- Add "Maritime / Ships" toggle to LayerPanel
- Toggle enables/disables the entire maritime layer
- When disabled: no markers rendered, no API calls
- When enabled: load latest vessel positions from API
- Status: "Coming Soon" badge until data is available

---

## Ship Markers

### Visual Design

| Property | Value |
|----------|-------|
| **Shape** | Circle dot (8-12px) with heading arrow |
| **Color** | By vessel type (see color scheme below) |
| **Heading indicator** | Small arrow or triangle pointing in vessel heading direction |
| **Stale marker** | Dimmed/grayed out when position is older than threshold |

### Vessel Type Color Scheme

| Vessel Type | Color | Rationale |
|-------------|-------|-----------|
| Cargo | Blue | Large commercial vessels |
| Tanker | Orange | Hazardous cargo, distinct |
| Passenger | Purple | Cruise ships, ferries |
| Fishing | Green | Fishing fleet |
| Tug | Yellow | Harbor/work vessels |
| Military | Red | Government/military |
| Pleasure/Sailing | Light Blue | Recreational |
| High Speed Craft | Cyan | Fast vessels |
| Other / Unknown | Gray | Unclassified |

**Constraint**: Do not use pure black or pure white as primary marker colors.

### Heading Arrow

- Small triangular pointer extending from the dot center
- Points in the direction of `true_heading`
- If `true_heading` is not available (511), no arrow is shown
- Arrow size: 4-6px extension beyond dot radius

---

## Stale Marker Handling

```javascript
const STALE_THRESHOLD_SECONDS = 300; // 5 minutes

function getMarkerOpacity(dataAgeSeconds) {
  if (dataAgeSeconds < 60) return 1.0;        // fresh: full opacity
  if (dataAgeSeconds < 120) return 0.8;       // recent: slightly dimmed
  if (dataAgeSeconds < 300) return 0.5;       // aging: dimmed
  return 0.3;                                  // stale: very dimmed
}
```

Stale markers (no update in 5+ minutes):
- Reduced opacity (0.3)
- Gray tint
- Tooltip shows "Stale: last update X minutes ago"
- Not removed from map (vessel may still be there, just not reporting)

---

## Click Card (Detail Panel)

When user clicks a vessel marker, show detail card:

### Card Layout

```
┌─────────────────────────────────┐
│  CARGO SHIP ONE          [cargo]│
│  MMSI: 123456789                │
│  IMO: 9876543                    │
│  Callsign: ABCD                 │
│─────────────────────────────────│
│  Position                       │
│  Lat: 37.7749° N                │
│  Lon: 122.4194° W               │
│  Speed: 12.5 knots              │
│  Course: 180°                   │
│  Heading: 178°                  │
│  Status: Under way using engine │
│─────────────────────────────────│
│  Voyage                         │
│  Destination: USLAX             │
│  ETA: Jun 12, 2026 08:00 UTC   │
│  Draught: 12.5 m               │
│─────────────────────────────────│
│  Dimensions                     │
│  Length: 200 m                  │
│  Width: 30 m                   │
│─────────────────────────────────│
│  Data                           │
│  Source: AISStream              │
│  Last update: 2 minutes ago    │
│  Position time: 12:00 UTC      │
└─────────────────────────────────┘
```

### Card Fields

| Field | Source | Display |
|-------|--------|---------|
| Vessel name | ShipStaticData | Bold header |
| Vessel type | ShipStaticData | Colored badge |
| MMSI | PositionReport | Monospace |
| IMO | ShipStaticData | "Not available" if missing |
| Callsign | ShipStaticData | "Not available" if missing |
| Latitude | PositionReport | Formatted DMS |
| Longitude | PositionReport | Formatted DMS |
| Speed | PositionReport | Knots with unit |
| Course | PositionReport | Degrees with unit |
| Heading | PositionReport | Degrees with unit |
| Navigation status | PositionReport | Human-readable text |
| Destination | ShipStaticData | "Not available" if missing |
| ETA | ShipStaticData | Formatted datetime |
| Draught | ShipStaticData | Meters with unit |
| Length | ShipStaticData | Meters with unit |
| Width | ShipStaticData | Meters with unit |
| Source | Metadata | "AISStream" |
| Last update | received_at | Relative time ("2 min ago") |
| Position time | timestamp_utc | ISO8601 UTC |

---

## Source Attribution

Display in bottom-right corner of maritime layer view:

```
Data: AISStream (live AIS) | Last update: 12:00 UTC
```

Updated whenever data refreshes.

---

## Refresh / Update Strategy

MVP: REST polling (no WebSocket/SSE).

```javascript
const REFRESH_INTERVAL_MS = 30000; // 30 seconds

// On each interval:
// 1. Fetch latest positions from API with current viewport bbox
// 2. Update Cesium entities (add/update/remove)
// 3. Update stale status for all markers
```

### Viewport-Based Loading

For MVP, load vessels visible in the current viewport:

```javascript
function getViewportBbox(viewer) {
  const rectangle = viewer.camera.computeViewRectangle();
  return {
    west: Cesium.Math.toDegrees(rectangle.west),
    south: Cesium.Math.toDegrees(rectangle.south),
    east: Cesium.Math.toDegrees(rectangle.east),
    north: Cesium.Math.toDegrees(rectangle.north)
  };
}
```

API call:
```
GET /api/layers/layer_06_maritime/objects?bbox=-122.5,37.5,-122.0,38.0&limit=500
```

### Global Loading (Alternative)

For global view (zoomed out), load all vessels with a cap:

```javascript
const GLOBAL_VESSEL_CAP = 5000;

if (zoomLevel < threshold) {
  // Load all vessels up to cap
  fetch('/api/layers/layer_06_maritime/objects?limit=5000');
} else {
  // Load viewport only
  fetch(`/api/layers/layer_06_maritime/objects?bbox=${bbox}&limit=500`);
}
```

---

## Clustering / Viewport Limiting

For areas with many vessels (major ports, straits):

**MVP**: Simple viewport limiting + API limit. No client-side clustering.

**Future**: 
- Client-side clustering at low zoom levels
- Aggregated counts at very low zoom ("1,250 vessels at this zoom")
- Port-area detail zoom

---

## No Fake Movement

- Vessels do not move between position updates (no interpolation)
- Position markers jump to new position on data refresh
- If interpolation is desired later, it must be explicitly implemented and documented
- MVP: discrete position updates every 30 seconds

---

## Future: Path / Trails

When a vessel is clicked, show its recent path:

```javascript
// Fetch position history
const positions = await fetch(`/api/layers/layer_06_maritime/vessels/${mmsi}/positions?hours=24`);

// Render as polyline on globe
const pathEntity = viewer.entities.add({
  polyline: {
    positions: positions.map(p => Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude)),
    width: 2,
    material: new Cesium.PolylineGlowMaterialProperty({
      glowPower: 0.1,
      color: vesselColor
    })
  }
});
```

Not in MVP scope — included for planning reference.

---

## Performance Considerations

- Cesium entity count: cap at 5000 for MVP (60 FPS safe)
- Use `viewer.entities.suspendEvents()` during batch updates
- Remove entities that leave viewport (or mark as invisible)
- Use `requestAnimationFrame` for smooth updates
- Debounce viewport-based refresh to avoid excessive API calls

---

## Layer Folder Structure

Following the project convention:

```
apps/web/src/layers/layer_06_maritime/
    index.ts                    # Layer registration
    MaritimeLayer.tsx           # Main layer component
    vesselMarker.ts             # Cesium entity creation for vessels
    vesselColors.ts             # Vessel type → color mapping
    vesselFilters.ts            # Filter logic
    vesselDetailCard.tsx        # Click card component
    maritimeApi.ts              # API client for maritime endpoints
    maritimeRefresh.ts          # Refresh/polling logic
```

---

## Testing Checklist

- [ ] Maritime layer toggle appears in LayerPanel
- [ ] Vessel markers render at real positions
- [ ] Markers show heading direction
- [ ] Color matches vessel type
- [ ] Click marker opens detail card
- [ ] Detail card shows all fields
- [ ] Stale markers are visually dimmed
- [ ] Data refreshes every 30 seconds
- [ ] Source attribution visible
- [ ] No console errors
- [ ] 60 FPS maintained
- [ ] Works at various zoom levels
- [ ] Works when zoomed out to global view
- [ ] Existing layers (aviation, borders, earth events, space) unaffected
