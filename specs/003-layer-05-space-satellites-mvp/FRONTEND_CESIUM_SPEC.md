# Frontend (Cesium) Specification: Layer 05 Space & Satellites

**Lane Owner**: Sonnet 4.6  
**Status**: Specification (Not Implemented)

---

## Overview

The Space & Satellites frontend layer renders orbital objects on a Cesium.js globe with real-time position updates, interactive filtering, and detailed metadata panels.

**Framework**: Cesium.js (3D WebGL globe)  
**State Management**: Existing GOD EYES layer state system  
**WebSocket Integration**: Real-time position streaming from `/ws/layer-05/positions`

---

## Layer Architecture

### Component Hierarchy

```
SpaceSatellitesLayer
├── LayerToggle (enable/disable layer)
├── SatelliteRenderer (Cesium entities + graphics)
│   ├── SatelliteVisual (dots for active payloads)
│   ├── DebrisVisual (triangles for debris/rocket bodies)
│   └── ImportantHighlight (glow/emphasis for important objects)
├── FilterPanel
│   ├── CategoryFilter (multi-select)
│   ├── ObjectTypeFilter (dropdown)
│   ├── AltitudeRangeSlider
│   ├── OperatorFilter (text)
│   └── ApplyFilters (button)
├── ColorModeToggle (Altitude or Category)
├── VisualizationControls
│   ├── LabelToggle (show/hide names)
│   ├── DebrisToggle (show/hide debris)
│   └── ImportanceToggle (show only important)
├── DetailsPanel (on click)
│   └── ObjectMetadataDisplay
└── WebSocketManager (position streaming)
```

---

## Layer Initialization

### On Layer Enable

1. **Fetch Satellite Catalog**
   - Call `GET /api/layer-05/satellites?limit=1000` (paginate for large catalogs)
   - Cache results in state

2. **Initialize WebSocket**
   - Connect to `/ws/layer-05/positions`
   - Subscribe to all visible objects

3. **Render Initial Entities**
   - Create Cesium `Entity` for each object
   - Assign graphics (dots for satellites, triangles for debris)
   - Apply initial colors (by altitude or category)

4. **Start Position Updates**
   - Every 5 seconds, receive updated positions from WebSocket
   - Update entity positions smoothly (optional: interpolation)

### On Layer Disable

1. **Unsubscribe from WebSocket**
   - Send `unsubscribe` message for all objects
   - Disconnect if no other layers using WebSocket

2. **Clear Cesium Entities**
   - Remove all satellite/debris entities from globe
   - Clear references in state

---

## Rendering Strategy

### Satellite Rendering (PAYLOAD)

**Shape**: Circle (dot)  
**Size**: Small (8–12 pixels at default zoom)  
**Color**: By altitude class or category (user selectable)

```javascript
const satelliteEntity = viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude * 1000),
  point: {
    pixelSize: 10,
    color: Cesium.Color.fromCssColorString(getColorByAltitude(altitudeKm)),
    outlineColor: Cesium.Color.WHITE,
    outlineWidth: 1,
    heightReference: Cesium.HeightReference.NONE,
    scaleByDistance: new Cesium.NearFarScalar(1.5e2, 2.0, 1.5e7, 0.5)
  },
  label: {
    text: name,
    font: '12px sans-serif',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, 10),
    show: labelVisibility
  },
  properties: {
    name: name,
    norad_id: noradId,
    category: category,
    altitude: altitudeKm,
    speed: speedKmS,
    object_type: objectType
  }
});
```

---

### Debris Rendering (DEBRIS, ROCKET BODY)

**Shape**: Triangle (△)  
**Size**: Small (6–10 pixels at default zoom)  
**Color**: Red or dark red (distinct from satellites)

```javascript
const debrisEntity = viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude * 1000),
  model: {
    // Use a small pyramid/triangle model or custom graphics
    uri: Cesium.BoxGraphics.ConstructorOptions, // or custom triangle mesh
    minimumPixelSize: 8,
    color: Cesium.Color.RED
  },
  // Alternative: Use Cesium.Primitive with custom graphics
  // Or polyline to draw a small triangle outline
  label: {
    text: name,
    font: '10px sans-serif',
    fillColor: Cesium.Color.WHITE,
    outlineColor: Cesium.Color.BLACK,
    outlineWidth: 2,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(0, 10),
    show: labelVisibility
  },
  properties: {
    name: name,
    norad_id: noradId,
    category: category,
    object_type: objectType
  }
});
```

---

### Important Satellite Highlighting

**Visual Treatment**: Larger marker, glow, or special outline

```javascript
if (importance_flag) {
  satelliteEntity.point.pixelSize = 16; // Larger
  satelliteEntity.point.outlineWidth = 3; // Thicker outline
  
  // Optional: Add glow via custom shader or second entity
  const glowEntity = viewer.entities.add({
    position: satelliteEntity.position,
    ellipse: {
      semiMajorAxis: 500000, // ~500 km radius
      semiMinorAxis: 500000,
      material: Cesium.Color.YELLOW.withAlpha(0.1),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 1
    }
  });
  
  satelliteEntity.glowEntity = glowEntity; // Link for cleanup
}
```

---

## Color Schemes

### Color by Altitude Class

```javascript
function getColorByAltitude(altitudeKm) {
  if (altitudeKm < 400) return '#00FFFF';  // VLEO - Cyan
  if (altitudeKm < 2000) return '#0000FF'; // LEO - Blue
  if (altitudeKm < 35786) return '#00FF00'; // MEO - Green
  if (altitudeKm < 36000) return '#FF0000'; // GEO - Red
  return '#FFA500'; // HEO - Orange
}
```

### Color by Category

```javascript
const CATEGORY_COLORS = {
  'STARLINK': '#00B4EB',        // Light Blue
  'COMMUNICATIONS': '#9900FF',  // Purple
  'NAVIGATION': '#CCFF00',      // Yellow-Green
  'WEATHER': '#00FF99',         // Light Green
  'EARTH_OBSERVATION': '#00AA00', // Dark Green
  'SCIENCE': '#FF9900',         // Orange
  'CREWED': '#FFFF00',          // Yellow/Bright
  'DEBRIS': '#FF0000',          // Red
  'ROCKET_BODY': '#990000',     // Dark Red
  'INACTIVE': '#888888',        // Gray
  'UNKNOWN': '#9966FF'          // Dim Purple
};

function getColorByCategory(category) {
  return CATEGORY_COLORS[category] || '#888888';
}
```

---

## Filter Panel

### Layout

```
┌─────────────────────────────────────────┐
│      Space & Satellites Filters         │
├─────────────────────────────────────────┤
│                                         │
│  Category (Multi-select)                │
│  ☑ Starlink      ☑ Communications      │
│  ☑ Navigation    ☑ Weather             │
│  ☑ Earth Obs     ☑ Science             │
│  ☑ Crewed        ☑ Debris              │
│  ☑ Rocket Body   ☑ Inactive            │
│  ☑ Unknown                             │
│                                         │
│  Object Type                            │
│  ⊙ All    ○ Payload    ○ Debris        │
│                                         │
│  Altitude Range (km)                    │
│  Min: ├──────●──────┤ Max: 36000       │
│        0              35786             │
│                                         │
│  Operator (Text Search)                 │
│  [     SpaceX          ] (optional)     │
│                                         │
│  ☑ Show Labels                         │
│  ☑ Show Debris                         │
│  ☐ Important Only                      │
│                                         │
│            [Apply Filters]              │
│            [Reset Filters]              │
│                                         │
│  Color By: ◉ Altitude  ○ Category      │
│                                         │
└─────────────────────────────────────────┘
```

### Filter State Management

```javascript
const filterState = {
  categories: ['STARLINK', 'COMMUNICATIONS', 'NAVIGATION', ...],
  object_type: 'ALL', // 'ALL', 'PAYLOAD', 'DEBRIS'
  altitude_min_km: 0,
  altitude_max_km: 36000,
  operator: '', // empty or search string
  show_labels: true,
  show_debris: true,
  importance_only: false,
  color_mode: 'altitude' // 'altitude' or 'category'
};
```

### Filter Application

When user clicks "Apply Filters":

1. Query API with current filter state
2. Fetch filtered object list
3. Rerender Cesium entities

```javascript
async function applyFilters(filters) {
  const params = new URLSearchParams({
    limit: 5000,
    offset: 0
  });
  
  filters.categories.forEach(cat => params.append('category', cat));
  if (filters.object_type !== 'ALL') {
    params.append('object_type', filters.object_type);
  }
  if (filters.altitude_min_km > 0) {
    params.append('min_altitude_km', filters.altitude_min_km);
  }
  if (filters.altitude_max_km < 100000) {
    params.append('max_altitude_km', filters.altitude_max_km);
  }
  if (filters.operator) {
    params.append('operator', filters.operator);
  }
  
  const response = await fetch(`/api/layer-05/satellites?${params}`);
  const data = await response.json();
  
  // Clear existing entities
  clearSatelliteEntities();
  
  // Render filtered results
  renderSatellites(data.objects);
}
```

---

## Detail Panel

### Layout

```
┌──────────────────────────────────────┐
│  ISS (ZARYA)                    [×]  │
├──────────────────────────────────────┤
│                                      │
│  Basic Information                   │
│  ├─ Name: ISS (ZARYA)               │
│  ├─ NORAD ID: 25544                 │
│  ├─ Intl. Designator: 1998-067A    │
│  └─ Type: Payload (Crewed)          │
│                                      │
│  Orbital Data                        │
│  ├─ Altitude: 408.5 km              │
│  ├─ Speed: 7.66 km/s                │
│  ├─ Orbit Class: LEO                │
│  ├─ Apogee: 408.5 km                │
│  ├─ Perigee: 408.5 km               │
│  ├─ Inclination: 51.64°             │
│  ├─ Period: ~92.3 minutes           │
│  └─ Eccentricity: 0.0003456         │
│                                      │
│  Current Position                    │
│  ├─ Latitude: 45.2231°              │
│  ├─ Longitude: -122.6765°           │
│  ├─ Altitude: 408.5 km              │
│  └─ Timestamp: 2026-05-31 13:45 UTC │
│                                      │
│  Metadata                            │
│  ├─ Operator: NASA/RSA              │
│  ├─ Mission: ISS                    │
│  ├─ Source: CelesTrak               │
│  ├─ Data Age: 1 hour                │
│  ├─ TLE Age: 1 hour                 │
│  ├─ Important: ✓ Yes                │
│  └─ Last Updated: 2026-05-31 11:00  │
│                                      │
│                [View on Space-Track] │
│                                      │
└──────────────────────────────────────┘
```

### Detail Panel Implementation

```javascript
function showDetailPanel(objectId, satelliteData) {
  const panel = document.getElementById('detail-panel');
  
  panel.innerHTML = `
    <div class="detail-header">
      <h2>${satelliteData.name}</h2>
      <button onclick="closeDetailPanel()">×</button>
    </div>
    
    <div class="detail-section">
      <h3>Basic Information</h3>
      <p><strong>Name:</strong> ${satelliteData.name}</p>
      <p><strong>NORAD ID:</strong> ${satelliteData.norad_catalog_id}</p>
      <p><strong>Intl. Designator:</strong> ${satelliteData.international_designator}</p>
      <p><strong>Type:</strong> ${satelliteData.object_type} (${satelliteData.category})</p>
    </div>
    
    <div class="detail-section">
      <h3>Orbital Data</h3>
      <p><strong>Altitude:</strong> ${satelliteData.estimated_altitude_km.toFixed(1)} km</p>
      <p><strong>Speed:</strong> ${satelliteData.estimated_speed_km_s.toFixed(2)} km/s</p>
      <p><strong>Orbit Class:</strong> ${satelliteData.orbit_class}</p>
      <p><strong>Apogee:</strong> ${satelliteData.orbital_elements.apogee_km.toFixed(1)} km</p>
      <p><strong>Perigee:</strong> ${satelliteData.orbital_elements.perigee_km.toFixed(1)} km</p>
      <p><strong>Inclination:</strong> ${satelliteData.orbital_elements.inclination_degrees.toFixed(2)}°</p>
      <p><strong>Eccentricity:</strong> ${satelliteData.orbital_elements.eccentricity.toFixed(6)}</p>
    </div>
    
    <div class="detail-section">
      <h3>Current Position</h3>
      <p><strong>Latitude:</strong> ${satelliteData.current_position.latitude.toFixed(4)}°</p>
      <p><strong>Longitude:</strong> ${satelliteData.current_position.longitude.toFixed(4)}°</p>
      <p><strong>Altitude:</strong> ${satelliteData.current_position.altitude_km.toFixed(1)} km</p>
      <p><strong>Timestamp:</strong> ${new Date(satelliteData.current_position.timestamp).toUTCString()}</p>
    </div>
    
    <div class="detail-section">
      <h3>Metadata</h3>
      <p><strong>Operator:</strong> ${satelliteData.operator || 'Unknown'}</p>
      <p><strong>Mission:</strong> ${satelliteData.mission || 'Unknown'}</p>
      <p><strong>Source:</strong> ${satelliteData.metadata.source}</p>
      <p><strong>Data Age:</strong> ${satelliteData.metadata.data_age_hours} hour(s)</p>
      <p><strong>TLE Age:</strong> ${satelliteData.current_position.tle_age_hours} hour(s)</p>
      <p><strong>Important:</strong> ${satelliteData.importance_flag ? '✓ Yes' : '✗ No'}</p>
      <p><strong>Last Updated:</strong> ${new Date(satelliteData.metadata.updated_at).toLocaleString()}</p>
    </div>
  `;
  
  panel.style.display = 'block';
}
```

---

## Position Update via WebSocket

### Subscription Logic

```javascript
class SatelliteWebSocketManager {
  constructor(viewer, objects) {
    this.viewer = viewer;
    this.objects = objects;
    this.ws = null;
    this.subscriptionIds = new Set();
  }
  
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/layer-05/positions`;
    
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      console.log('Connected to Space & Satellites WebSocket');
      this.subscribe();
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'position_update') {
        this.handlePositionUpdate(message);
      } else if (message.type === 'heartbeat') {
        // Keep-alive, no action needed
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  subscribe() {
    const objectIds = this.objects.map(obj => obj.id);
    
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      object_ids: objectIds,
      update_interval_ms: 5000
    }));
    
    objectIds.forEach(id => this.subscriptionIds.add(id));
  }
  
  handlePositionUpdate(message) {
    message.positions.forEach(position => {
      const entity = this.viewer.entities.getById(position.object_id);
      
      if (entity) {
        // Update position
        entity.position = Cesium.Cartesian3.fromDegrees(
          position.longitude,
          position.latitude,
          position.altitude_km * 1000
        );
        
        // Optional: Update properties for display
        entity.properties.altitude = position.altitude_km;
        entity.properties.speed = position.speed_km_s;
      }
    });
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

---

## Interactions & UX

### Click to Detail
- User clicks satellite/debris marker
- Detail panel opens with full metadata
- Globe camera focuses on object (optional)

### Hover Behavior
- Highlight entity (brighten color, increase outline)
- Show name tooltip (if labels hidden)

### Camera Navigation
- Double-click to center on object
- Mouse scroll to zoom
- Drag to rotate/pan

---

## Performance Considerations

1. **Entity Limit**: Cesium can render 10,000+ entities smoothly on modern hardware
   - Start with 1000 most important objects if needed
   - Implement pagination/LOD if > 10,000

2. **Position Updates**: WebSocket delivers ~100 positions/update
   - Batch update positions in Cesium (avoid individual redraws)
   - Use `disableDepthTestDistance` for high-altitude objects

3. **Label Rendering**: Disable labels at certain zoom levels
   - `scaleByDistance` for automatic label fade

4. **Memory**: Keep reference to entities for fast updates
   ```javascript
   const entityMap = new Map(); // objectId → CesiumEntity
   ```

---

## Accessibility

- Color-blind friendly palette (avoid red-green only)
- Keyboard navigation (Tab through filters, Enter to apply)
- Screen reader support for detail panel
- High contrast mode support

---

## Mobile Responsiveness (Post-MVP)

- Stack filters vertically on small screens
- Touch-friendly gestures (two-finger zoom, long-press for detail)
- Simplified detail panel for mobile

---

## Known Limitations (MVP)

- No position interpolation (discrete position jumps every 5 seconds)
- No satellite name labels on small zoom levels (performance)
- No constellation link visualization (post-MVP)
- No historical playback (post-MVP)

---

**Frontend Status**: ✅ Specification complete  
**Implementation Status**: ⏳ Pending (Sonnet 4.6 lane)  
**Review Status**: ⏳ Pending (Claude Haiku 4.5)
