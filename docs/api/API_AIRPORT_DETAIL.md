# Airport Detail API v1

WO-022: Aviation Airport Detail endpoint for Object Intel panel.

## Endpoint

```
GET /api/layers/:layerId/objects/:objectId/detail
```

## Purpose

Read-only endpoint providing comprehensive airport information for the frontend Object Intel panel:
- Airport overview (enriched from list response)
- Runways
- Airport frequencies
- Nearby navaids with bounded spatial lookup
- Metadata

## Supported Layers

- `layer_01_aviation`

## Supported Object Types

- `airport`

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coordinates` | `source` \| `effective` | `source` | Coordinate mode. Source uses raw coordinates. Effective uses active approved overrides when available. |
| `navaidRadiusKm` | integer | 100 | Search radius for nearby navaids in km. Max: 250. Clamped if exceeded. |
| `navaidLimit` | integer | 20 | Maximum number of nearby navaids to return. Max: 50. Clamped if exceeded. |

## Response Structure

```json
{
  "airport": {
    "id": "uuid",
    "layerId": "layer_01_aviation",
    "objectType": "airport",
    "sourceId": "string",
    "sourceObjectId": "string",
    "name": "string",
    "ident": "string",
    "iataCode": "string|null",
    "category": "string",
    "typeSource": "string",
    "country": "string|null",
    "region": "string|null",
    "municipality": "string|null",
    "position": {
      "latitude": "number|null",
      "longitude": "number|null"
    },
    "elevationFt": "number|null",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  },
  "runways": [
    {
      "id": "uuid",
      "ident": "string",
      "lengthFt": "number|null",
      "widthFt": "number|null",
      "surface": "string|null",
      "lighted": "boolean|null",
      "closed": "boolean|null",
      "leIdent": "string|null",
      "leLatitude": "number|null",
      "leLongitude": "number|null",
      "leElevationFt": "number|null",
      "leHeadingDeg": "number|null",
      "heIdent": "string|null",
      "heLatitude": "number|null",
      "heLongitude": "number|null",
      "heElevationFt": "number|null",
      "heHeadingDeg": "number|null"
    }
  ],
  "frequencies": [
    {
      "id": "uuid",
      "type": "string",
      "description": "string|null",
      "frequencyMhz": "number|null"
    }
  ],
  "nearbyNavaids": [
    {
      "id": "uuid",
      "ident": "string",
      "name": "string",
      "type": "string",
      "frequencyKhz": "number|null",
      "latitude": "number|null",
      "longitude": "number|null",
      "elevationFt": "number|null",
      "distanceKm": "number|null"
    }
  ],
  "metadata": {
    "generatedAt": "ISO8601",
    "layerId": "layer_01_aviation",
    "objectId": "uuid",
    "coordinates": "effective|undefined",
    "runwayCount": "number",
    "frequencyCount": "number",
    "nearbyNavaidCount": "number",
    "navaidRadiusKm": "number"
  }
}
```

## Coordinate Mode Behavior

### `coordinates=source` (default)
- Uses raw `aviation_airports.latitude_deg` and `aviation_airports.longitude_deg`
- Source coordinates are never mutated
- No provenance metadata added

### `coordinates=effective`
- Uses active approved override from `aviation_coordinate_overrides` when available
- Falls back to source coordinates when no override exists
- Raw source data preserved
- Metadata includes `coordinates: "effective"` when override is applied

## Runways

- Queried by `airport_ident` matching the airport's ident
- Ordered by length descending
- All records returned (no limit in v1 - may add limit in future)
- Many runway records may have missing endpoint coordinates due to source data limitations

## Frequencies

- Queried by `airport_ident` matching the airport's ident
- Ordered by type
- All records returned (no limit in v1)

## Nearby Navaids

- Uses bounded spatial lookup with `ST_DWithin` (PostGIS geography)
- Distance computed using `ST_Distance` with geography for accuracy
- Default radius: 100km, Max: 250km
- Default limit: 20, Max: 50
- Results ordered by distance ascending
- Returns empty array if airport has no valid coordinates

## Known Limitations

1. **No live operational data** - No NOTAM, METAR, or TAF integration yet
2. **No runway endpoint coordinates** - Many runway records may have null endpoint coordinates due to source data limitations
3. **Clusters unaffected** - The `/objects` list endpoint with `mode=clusters` uses source coordinates only
4. **No caching** - Detail endpoint is not cached in v1
5. **No authentication** - Endpoint is read-only, no auth required in v1

## Future Frontend Object Intel Usage

The Object Intel panel can use this endpoint to:
1. Fetch airport overview with source/provenance info
2. Show runway summary with visual indicators
3. Display frequency bands (ATIS, tower, approach, etc.)
4. Plot nearby navaids on a local map
5. Show coordinate mode and override provenance when available

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_COORDINATES` | Invalid coordinates parameter |
| 400 | `INVALID_NAVAID_PARAMS` | Invalid navaidRadiusKm or navaidLimit |
| 404 | `INVALID_LAYER` | Unknown layer ID |
| 404 | `OBJECT_NOT_FOUND` | Airport not found |
| 503 | `DATABASE_OFFLINE` | Database unavailable |

## Example Requests

### Basic detail
```
GET /api/layers/layer_01_aviation/objects/{airportId}/detail
```

### With effective coordinates
```
GET /api/layers/layer_01_aviation/objects/{airportId}/detail?coordinates=effective
```

### Custom navaid search radius
```
GET /api/layers/layer_01_aviation/objects/{airportId}/detail?navaidRadiusKm=50&navaidLimit=10
```

## Implementation Notes

- SQL queries are parameterized
- Spatial lookup uses PostGIS geography functions for accuracy
- Source data is never mutated
- All existing contracts are preserved for backward compatibility