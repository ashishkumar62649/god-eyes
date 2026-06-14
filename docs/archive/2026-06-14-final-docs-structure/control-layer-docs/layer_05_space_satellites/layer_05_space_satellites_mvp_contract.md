# Layer 05 — Space & Satellites MVP Lane Contract

> **Status note (alignment pass):** This lane contract is **historical/completed**. Layer 05
> Space & Satellites is implemented in the current code (fetcher/worker, API routes,
> WebSocket, frontend, and tests). The authoritative status is in
> `docs/control/MVP_LAYER_REGISTRY.md`. The content below is preserved for reference.

## 1. Layer Identity

- **Layer ID:** `layer_05_space_satellites`
- **Display Name:** Space & Satellites
- **MVP Status:** active — this lane contract is **historical**; Layer 05 is implemented (see `docs/control/MVP_LAYER_REGISTRY.md` and current code). UI toggle defaults OFF.
- **Type:** live (estimated orbital positions)
- **Canonical Folders:**
  - Fetching: `services/fetch-orchestrator/src/layers/layer_05_space_satellites/`
  - API: `apps/api/src/routes/space/`
  - Frontend: `apps/web/src/layers/space/satellites/`
  - Tests: `tests/data/layer_05_space_satellites/`

## 2. MVP Scope

Show public satellites and space debris around Earth with:
- Satellite object markers (dots)
- Debris/junk markers (triangles)
- Altitude-based color coding
- Object category filtering
- Important object highlighting
- Info panel on selection
- REST API endpoints
- WebSocket live position stream
- Frontend layer toggle and rendering

## 3. Non-MVP Scope

- Classified satellite tracking
- Real-time sensor data (ADS-B style)
- Confirmed live communication links
- Historical position playback
- Debris collision prediction
- Orbital decay estimation
- User-created satellite alerts
- Custom constellation tracking

## 4. Data Source Strategy

**Primary:** CelesTrak public TLE feeds
- Free, public, no authentication required
- Updated regularly (daily/weekly)
- Covers active satellites and debris
- Fetch frequency: once per day, off-peak

**Secondary:** Space-Track enrichment (optional)
- Authenticated via environment variables only
- Never print or commit API keys
- Used for catalog enrichment if available
- Fallback to CelesTrak if unavailable

**Storage:** Local database
- Store orbital elements (TLE) locally
- Compute positions on-demand from elements
- Stream estimated positions via WebSocket
- Do not claim real-time sensor confirmation

## 5. Database Lane Contract

**Owner:** Codex  
**Branch:** `agent/wo-082b-space-db`  
**Folder:** `E:\god-eyes-db`

**Deliverables:**
- Database migrations in `database/migrations/layers/layer_05_space_satellites/`
- Table definitions with `layer_id` and `source_id`
- Indexes for performance
- Data tests in `tests/data/layer_05_space_satellites/`
- No secrets in any files

**Tables:**
- `space_satellites` — catalog (NORAD ID, name, type, country, launch date)
- `space_satellite_positions_latest` — current estimated position
- `space_satellite_positions_history` (optional) — historical positions
- `space_satellite_links_estimated` (optional) — constellation links

**Schema Requirements:**
- `layer_id = 'layer_05_space_satellites'`
- `source_id` (e.g., 'celestrak', 'space-track')
- `source_object_id` (NORAD catalog number)
- Timestamps in UTC
- Coordinates as lat/lon/altitude

## 6. Fetching Lane Contract

**Owner:** MiniMax  
**Branch:** `agent/wo-082c-space-fetching`  
**Folder:** `E:\god-eyes-fetching`

**Deliverables:**
- CelesTrak fetcher in `services/fetch-orchestrator/src/layers/layer_05_space_satellites/`
- Space-Track enrichment support (env-based auth only)
- Normalizer for TLE → position computation
- Classification logic (satellite vs debris vs rocket body)
- Position computation from orbital elements
- Database writer
- Tests covering all components
- No secrets printed or committed

**Fetcher Behavior:**
- Fetch CelesTrak TLE daily
- Parse and validate TLE format
- Compute current position from elements
- Classify object type
- Write to database
- Handle errors gracefully

## 7. API Lane Contract

**Owner:** DeepSeek  
**Branch:** `agent/wo-082d-space-api`  
**Folder:** `E:\god-eyes-api`

**Deliverables:**
- REST endpoints in `apps/api/src/routes/space/`
- WebSocket endpoint for live stream
- Response contracts/types
- Tests for all endpoints

**Endpoints:**
- `GET /api/space/satellites` — list all satellites with filters
- `GET /api/space/satellites/:satelliteId` — single satellite details
- `GET /api/space/satellites/categories` — available object categories
- `WebSocket /ws/space/satellites/live` — position stream

**Response Format:**
```typescript
{
  satelliteId: string;
  noradId: number;
  name: string;
  type: 'satellite' | 'debris' | 'rocket_body';
  country: string;
  launchDate: string;
  position: { lat: number; lon: number; altitudeKm: number };
  velocity: { speedKmS: number };
  estimatedAt: string; // UTC timestamp
}
```

## 8. Frontend Lane Contract

**Owner:** Sonnet 4.6  
**Branch:** `agent/wo-082e-space-frontend`  
**Folder:** `E:\god-eyes-frontend`

**Deliverables:**
- Space layer toggle in LayerPanel
- Satellite dots (small, colored by altitude)
- Debris triangles (distinct from satellites)
- Altitude color scale
- Important object highlighting/glow
- WebSocket client for live updates
- SatelliteInfoOverlay component
- Category filters
- No unrelated frontend changes

**Visual Rules:**
- Satellites: dots, altitude-colored
- Debris: triangles, type-colored
- No black or white as primary colors
- Important objects: larger, glow effect
- Altitude bands: 8-color scale
- Debris types: distinct colors per category

## 9. Review Lane Contract

**Owner:** Claude Haiku 4.5  
**Branch:** `agent/wo-082f-space-review`  
**Folder:** `E:\god-eyes-review`

**Deliverables:**
- Review each lane branch independently
- Verify scope adherence
- Verify no secrets in any files
- Verify naming consistency (`layer_05_space_satellites`)
- Verify tests and builds pass
- Integration review after all lanes complete
- Final boss review before merge

## 10. Visual Encoding Rules

- **Satellites:** Small dots, altitude-based color
- **Debris:** Triangles, type-based color
- **Altitude Colors:** 8-band scale
  - Ground: gray
  - <2k km: orange
  - 2-5k km: yellow
  - 5-10k km: lime
  - 10-20k km: cyan
  - 20-30k km: blue
  - 30-40k km: purple
  - >40k km: red
- **Important Objects:** Larger size, glow/highlight effect
- **No black or white** as primary marker colors

## 11. WebSocket Message Contract Draft

```typescript
// Server → Client (position update)
{
  type: 'position_update';
  timestamp: string; // UTC
  satellites: [
    {
      satelliteId: string;
      position: { lat: number; lon: number; altitudeKm: number };
      velocity: { speedKmS: number };
    }
  ];
}

// Client → Server (filter request)
{
  type: 'filter';
  categories: ['satellite', 'debris'];
  minAltitudeKm: 0;
  maxAltitudeKm: 50000;
}
```

## 12. REST API Route Draft

```
GET /api/space/satellites
  ?category=satellite,debris
  &minAltitude=0
  &maxAltitude=50000
  &limit=1000

GET /api/space/satellites/:satelliteId

GET /api/space/satellites/categories

WebSocket /ws/space/satellites/live
```

## 13. Safety and Trust Rules

- **No real-time claims:** Label positions as "estimated" or "computed from orbital elements"
- **No confirmed links:** Constellation links are estimated, not confirmed real-time
- **No classified data:** Use only public sources
- **No secrets:** Never print or commit API keys; use environment variables only
- **Frequency limits:** Fetch upstream once per day, off-peak
- **Attribution:** Always credit CelesTrak and Space-Track in UI/docs

## 14. Integration Sequence

1. **Database lane (WO-082B):** Create schema, migrations, tests
2. **Fetching lane (WO-082C):** Implement fetcher, normalizer, tests
3. **API lane (WO-082D):** Implement endpoints, WebSocket, tests
4. **Frontend lane (WO-082E):** Implement UI, WebSocket client, tests
5. **Review lane (WO-082F):** Review all lanes, verify integration
6. **Boss review:** Final integration and merge to main

## 15. Acceptance Criteria

- [ ] All lane branches created with correct naming
- [ ] Database schema passes tests
- [ ] Fetcher retrieves and normalizes data correctly
- [ ] API endpoints return correct response format
- [ ] WebSocket stream delivers position updates
- [ ] Frontend renders satellites and debris correctly
- [ ] Altitude colors match specification
- [ ] Important objects highlighted
- [ ] No secrets in any committed files
- [ ] All tests pass (421+ data tests)
- [ ] Builds pass (contracts, API, web)
- [ ] Layer naming consistent: `layer_05_space_satellites`
- [ ] Integration review passes
- [ ] Ready for merge to main

---

**Created:** 2026-05-31  
**Status:** Lane contract defined, ready for parallel implementation
