# Airport Public Profile API Contract

## Endpoint
`GET /api/airports/:airportId/public-profile`

## Response Types

### Cache Hit Response
```json
{
  "status": "ok",
  "cached": true,
  "profile": {
    "id": "string",
    "name": "string",
    "iataCode": "string",
    "icaoCode": "string",
    "location": {
      "latitude": 0,
      "longitude": 0,
      "city": "string",
      "country": "string"
    },
    "summary": "string",
    "facts": {
      "iataCode": "string",
      "icaoCode": "string",
      "country": "string"
    }
  },
  "fetchedAt": "2023-01-01T00:00:00Z",
  "expiresAt": "2023-01-31T00:00:00Z",
  "attribution": {
    "source": "string",
    "matchMethod": "string",
    "matchConfidence": "string"
  }
}
```

### Cache Miss Behavior
On cache miss, the API will:
1. Fetch data from authoritative sources (OurAirports for identity, English Wikipedia for summary, Wikidata for structured facts)
2. Cache the response for 30 days
3. Return fresh data with `cached: false` field
4. Status will be `fetching` when profile is being fetched

### Stale Cache Behavior
When cache is stale:
- Serve stale content immediately with `cached: true` field
- Trigger background refresh
- Update cache with fresh data
- Status will be `stale` during revalidation

### No Profile Found Response
```json
{
  "status": "no_profile_found",
  "message": "No public profile available for this airport"
}
```

### Low Confidence Response
```json
{
  "status": "low_confidence_match",
  "message": "Profile data found but with low confidence"
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Failed to fetch airport profile"
}
```

## Response JSON Shape
```json
{
  "status": "string",
  "cached": true,
  "profile": {Profile Object},
  "fetchedAt": "string",
  "expiresAt": "string",
  "attribution": {
    "source": "string",
    "matchMethod": "string",
    "matchConfidence": "string"
  }
}
```

## Cache Policy
- Cache expires after 30 days
- Background refresh triggered on stale access
- ETag-based conditional requests for efficient updates

## Future Admin Endpoint
`POST /api/airports/:airportId/public-profile/refresh`
- May trigger immediate profile refresh
- Returns 202 Accepted on success