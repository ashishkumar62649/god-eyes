# Frontend Planning: Layer 07 Weather MVP

## Overview

This document defines the Cesium globe rendering strategy for the GOD EYES Weather layer.

---

## Cesium Globe Rendering Strategy

### Layer Component: WeatherLayer.tsx

A Cesium PrimitiveCollection (or BillboardCollection) that renders weather markers on the globe.

**Key behaviors:**
- Fetches weather data via project API (no direct database connection)
- Renders weather markers at grid cell resolved coordinates
- Updates on camera move (bbox-based refresh)
- Handles click picking for detail card
- Manages stale data visual state
- Cleans up Cesium primitives on unmount

### Data Flow

```
useWeather hook (REST polling)
    ↓
Weather data array (filtered by bbox)
    ↓
WeatherLayer.tsx (Cesium rendering)
    ↓
BillboardCollection (weather markers)
    ↓
Click picking → Detail card
```

---

## Weather Marker / Cell Strategy

### Marker Shape

**Circle with temperature-based fill color:**
- Size: 8-12px diameter (fixed, not zoom-dependent for MVP)
- Shape: Circle (Cesium Billboard with canvas-generated image)
- Border: 1px solid, slightly darker shade of fill color
- Centered at grid cell resolved coordinates

### Canvas Generation

```typescript
function createWeatherMarker(temperature: number, weatherCode: number, isStale: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;
    
    // Fill color based on temperature
    const color = getTemperatureColor(temperature);
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.fillStyle = isStale ? '#888' : color;
    ctx.fill();
    ctx.strokeStyle = isStale ? '#666' : darken(color, 0.2);
    ctx.lineWidth = 1;
    ctx.stroke();
    
    return canvas;
}
```

---

## Temperature Color Strategy

### Color Scale

| Temperature Range | Color | Hex |
|-------------------|-------|-----|
| < -10°C | Deep Blue | #1E3A5F |
| -10 to 0°C | Blue | #3B82F6 |
| 0 to 10°C | Light Blue | #60A5FA |
| 10 to 15°C | Teal | #2DD4BF |
| 15 to 20°C | Green | #22C55E |
| 20 to 25°C | Yellow | #EAB308 |
| 25 to 30°C | Orange | #F97316 |
| 30 to 35°C | Red | #EF4444 |
| > 35°C | Deep Red | #991B1B |

### Implementation

```typescript
function getTemperatureColor(tempC: number): string {
    if (tempC < -10) return '#1E3A5F';
    if (tempC < 0)   return '#3B82F6';
    if (tempC < 10)  return '#60A5FA';
    if (tempC < 15)  return '#2DD4BF';
    if (tempC < 20)  return '#22C55E';
    if (tempC < 25)  return '#EAB308';
    if (tempC < 30)  return '#F97316';
    if (tempC < 35)  return '#EF4444';
    return '#991B1B';
}
```

### Interpolation (Future Enhancement)

For smoother color transitions, use linear interpolation between color stops:
```typescript
function getTemperatureColorInterpolated(tempC: number): string {
    const stops = [
        { temp: -10, color: [30, 58, 95] },
        { temp: 0,   color: [59, 130, 246] },
        { temp: 10,  color: [96, 165, 250] },
        // ... more stops
    ];
    // Linear interpolation between nearest stops
    return interpolateColor(tempC, stops);
}
```

---

## Wind Direction Display Strategy

### MVP: No wind arrow on marker

For MVP, wind data is only shown in the detail card on click. The marker is a simple temperature-colored circle.

### Future Enhancement: Wind Arrow

Add a small triangle/arrow on the marker pointing in wind direction:
- Triangle apex points in the direction wind is coming FROM
- Color matches temperature scheme
- Size: 4-6px extending beyond circle

---

## Click Card Fields

### Weather Detail Card

When a weather marker is clicked, show a detail card with:

| Field | Display Label | Format |
|-------|---------------|--------|
| `temperature_c` | Temperature | XX.X °C |
| `apparent_temperature_c` | Feels Like | XX.X °C |
| `wind_speed_kph` | Wind Speed | XX.X km/h |
| `wind_direction_deg` | Wind Direction | XXX° (cardinal) |
| `wind_gust_kph` | Wind Gusts | XX.X km/h |
| `humidity_percent` | Humidity | XX% |
| `pressure_hpa` | Pressure | XXXX hPa |
| `precipitation_mm` | Precipitation | XX.X mm |
| `precipitation_probability_percent` | Precip. Probability | XX% |
| `cloud_cover_percent` | Cloud Cover | XX% |
| `weather_label` | Condition | Partly Cloudy |
| `forecast_for` | Forecast For | YYYY-MM-DD HH:MM |
| `fetched_at` | Last Updated | YYYY-MM-DD HH:MM |
| `is_stale` | Data Status | Fresh / Stale |
| `resolved_latitude` | Grid Latitude | XX.XX° |
| `resolved_longitude` | Grid Longitude | XX.XX° |
| `elevation_m` | Elevation | XXX m |
| `source_attribution` | Source | Open-Meteo (CC-BY 4.0) |

### Card Layout

```
┌─────────────────────────────┐
│  ☁ Partly Cloudy            │  ← weather_label with icon
│                             │
│  🌡 18.5 °C                 │  ← temperature_c
│  Feels like: 17.2 °C        │  ← apparent_temperature_c
│                             │
│  💨 12.3 km/h  ↗ 225°       │  ← wind_speed + direction
│  Gusts: 18.7 km/h           │  ← wind_gust_kph
│                             │
│  💧 65%  ☁ 45%              │  ← humidity + cloud_cover
│  🌧 0.0 mm (10%)            │  ← precipitation + probability
│  📊 1013.2 hPa              │  ← pressure
│                             │
│  📍 52.50°N, 13.50°E        │  ← resolved coordinates
│  ⛰ 44.8 m                   │  ← elevation
│                             │
│  ⏰ Forecast: Jun 10, 14:00  │  ← forecast_for
│  🔄 Updated: Jun 10, 12:00   │  ← fetched_at
│                             │
│  Source: Open-Meteo (CC-BY 4.0) │ ← attribution
└─────────────────────────────┘
```

### Cardinal Wind Direction

```typescript
function degreesToCardinal(deg: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
}
```

---

## Layer Panel Stats

### Weather Layer in LayerPanel

When Weather layer is toggled on, show:

```
┌─────────────────────────────┐
│  🌤 Weather / Live Weather   │
│  ─────────────────────────  │
│  Status: ● Active            │
│                             │
│  Total Cells: 2,664         │
│  Active: 2,500              │
│  Stale: 164                 │
│                             │
│  Last Updated: 2h ago       │
│  Source: Open-Meteo          │
│                             │
│  Temp Range: -35°C to 49°C  │
│  Avg: 15.3°C                │
│                             │
│  [Refresh] [Filters ▼]      │
└─────────────────────────────┘
```

### Statistics Displayed

| Stat | Source |
|------|--------|
| Total cells | `stats.totalLocations` |
| Active cells | `stats.activeLocations` |
| Stale cells | `stats.staleLocations` |
| Last updated | `stats.lastUpdated` (relative time) |
| Source | `stats.sourceId` |
| Temperature range | `stats.temperatureRange` |
| Weather conditions | `stats.weatherConditions` (top 3) |

---

## Controls

### Layer Panel Controls

1. **Visibility Toggle** — Show/hide weather markers on globe
2. **Refresh Button** — Force re-fetch of weather data
3. **Filters Dropdown**:
   - Temperature range slider (min/max)
   - Weather condition checkboxes (Clear, Cloudy, Rain, Snow, etc.)
   - Include stale data toggle
4. **Sort Dropdown**:
   - By temperature (hot/cold)
   - By wind speed
   - By humidity
   - By last updated

### Future Controls (Not MVP)
- Forecast time slider (tomorrow, day after)
- Model selector (ECMWF, GFS, etc.)
- Regional grid density selector

---

## Stale Data Visual Behavior

### Stale Marker Rendering

- **Opacity**: 50% for stale markers
- **Border**: Dashed border instead of solid
- **Color**: Grayscale (all temperatures shown as gray)
- **Tooltip**: "Data may be outdated — last updated X ago"

### Staleness Threshold

| Data Age | Visual State |
|----------|-------------|
| < 1 hour | Fresh (full opacity, color) |
| 1-3 hours | Aging (80% opacity, slightly muted) |
| 3-6 hours | Stale (50% opacity, grayscale) |
| > 6 hours | Very stale (30% opacity, hidden by default) |

### Implementation

```typescript
function getMarkerOpacity(fetchedAt: string): number {
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    
    if (ageHours < 1) return 1.0;
    if (ageHours < 3) return 0.8;
    if (ageHours < 6) return 0.5;
    return 0.3;
}
```

---

## Performance Constraints

### MVP Target
- **60 FPS** maintained with weather layer active
- **Max markers**: ~2,664 (5° global grid)
- **Marker update**: On camera move (bbox change)
- **API polling**: Every 5 minutes (or on-demand refresh)

### Optimization Strategies

1. **Bbox-based rendering**: Only render markers within current viewport
2. **Level-of-detail**: Hide markers at low zoom levels (zoom < 2)
3. **Static markers**: Markers don't animate (no movement)
4. **Efficient canvas**: Pre-generate marker canvases, reuse
5. **Primitive collection**: Use BillboardCollection for batch rendering
6. **Debounced updates**: Don't re-render on every camera move

### Performance Budget

| Metric | Target |
|--------|--------|
| FPS | ≥ 60 |
| Markers rendered | ≤ 3000 |
| API response time | < 500ms |
| Marker render time | < 16ms (per frame) |
| Memory usage | < 50MB (markers) |

---

## Future RainViewer Overlay Integration Plan

### Phase 1 (MVP): Weather Markers Only
- Temperature-colored markers at grid points
- Click detail card
- Source attribution

### Phase 2 (Future): Radar Precipitation Overlay
- RainViewer tile API integration
- XYZ tile layer on Cesium globe
- Time slider for past radar frames
- Opacity control for radar layer
- Toggle between weather markers and radar overlay

### Phase 3 (Future): Combined View
- Weather markers + radar overlay simultaneously
- Layer ordering (markers on top of radar)
- Conditional rendering (show radar only when precipitation > 0)

### RainViewer API Integration Notes

```
GET https://api.rainviewer.com/public/weather-maps.json
→ Returns available radar frames and tile URLs
→ Tile URL pattern: https://tilecache.rainviewer.com/v2/radar/{timestamp}/{size}/{z}/{x}/{y}/{color}/{options}.png
→ Cesium XYZ provider: new Cesium.UrlTemplateImageryProvider({ url: tileUrl })
```

### Why Not MVP
- RainViewer provides radar image tiles, not point data
- Requires Cesium ImageryLayer integration (different from BillboardCollection)
- Time-based tile animation adds complexity
- MVP needs point weather data (temperature, wind, etc.) which radar tiles don't provide

---

## API Client Integration

### useWeather Hook (similar to useMaritime)

```typescript
function useWeather() {
    const [weatherObjects, setWeatherObjects] = useState<WeatherObject[]>([]);
    const [stats, setStats] = useState<WeatherStats | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Poll every 5 minutes when active
    useEffect(() => {
        if (!isActive) return;
        
        const interval = setInterval(async () => {
            setLoading(true);
            const data = await fetchWeatherObjects(bbox);
            setWeatherObjects(data.objects);
            setLoading(false);
        }, 5 * 60 * 1000); // 5 minutes
        
        return () => clearInterval(interval);
    }, [isActive, bbox]);
    
    return { weatherObjects, stats, loading, refresh };
}
```

### API Client Functions

```typescript
async function fetchWeatherObjects(bbox: string, params?: WeatherQueryParams): Promise<WeatherObjectsResponse> {
    const url = `/api/layers/layer_07_weather/objects?bbox=${bbox}&${new URLSearchParams(params)}`;
    const response = await fetch(url);
    return response.json();
}

async function fetchWeatherDetail(objectId: string): Promise<WeatherDetailResponse> {
    const response = await fetch(`/api/layers/layer_07_weather/objects/${objectId}`);
    return response.json();
}

async function fetchWeatherStats(): Promise<WeatherStatsResponse> {
    const response = await fetch(`/api/layers/layer_07_weather/stats`);
    return response.json();
}
```

---

## Component File Structure

```
apps/web/src/layers/layer_07_weather/
    weatherApi.ts              # API client functions
    useWeather.ts              # React hook for REST polling
    weatherMarker.ts           # Temperature color mapping, canvas generation
    WeatherLayer.tsx           # Cesium BillboardCollection layer
    __tests__/
        weather.test.ts        # Unit tests
```

---

## Integration Points

### App.tsx
- Add weather layer state (active, filters, selection)
- Invoke useWeather hook
- Render WeatherLayer when active

### CesiumGlobe.tsx
- Import and render WeatherLayer
- Pass bbox from camera move events
- Handle click picking for weather markers

### LayerPanel.tsx
- Add Weather layer toggle
- Add weather-specific filters (temperature range, condition)
- Add weather stats display
- Add refresh button

### DetailPanel.tsx
- Render weather detail card when weather marker selected
- Show all weather fields with proper formatting
- Source attribution

### Shell.tsx
- Stats wrapper alignment for weather stats
