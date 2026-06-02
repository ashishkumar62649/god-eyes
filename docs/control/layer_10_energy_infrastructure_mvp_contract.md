# Layer 10 — Energy Infrastructure MVP Lane Contract

## 1. Layer Identity

- **Layer ID:** `layer_10_energy_infrastructure`
- **Display Name:** Energy Infrastructure
- **MVP Status:** coming_soon (specification phase)
- **Type:** static (no live updates for MVP)
- **Canonical Folders:**
  - Fetching: `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/`
  - API: `apps/api/src/routes/energy/`
  - Frontend: `apps/web/src/layers/energy/infrastructure/`
  - Tests: `tests/data/layer_10_energy_infrastructure/`

## 2. MVP Scope

Show public energy infrastructure with:
- Power plants (generation)
- Power substations (transmission nodes)
- High-voltage power transmission lines (transmission)
- Oil pipelines (fossil fuel transport)
- Gas pipelines (fossil fuel transport)
- LNG terminals (fossil fuel transport)
- Major oil/gas terminals (if source allows)
- Category-based filtering
- Source-based filtering
- Info panel on selection
- REST API endpoints
- Frontend layer toggle and rendering (static, no WebSocket)

## 3. Non-MVP Scope

- Live energy flow data
- Real-time grid balancing
- Operational control data
- Classified/secret energy infrastructure
- Substation internals or transformer details
- Low-voltage distribution networks
- Individual consumer connections
- Energy pricing data
- Demand/supply forecasting
- Renewable energy output predictions
- Grid failure cascades
- Detailed pipeline flow rates
- Tank farm inventory levels
- Security vulnerability assessments

## 4. Data Source Strategy

### Primary Sources

| # | source_id | Source Name | Homepage | Data Types | Formats | License/Caveats | Refresh Cadence | Raw Cache Strategy | Normalization Strategy | Expected Limitations |
|---|-----------|-------------|----------|------------|---------|-----------------|-----------------|-------------------|------------------------|----------------------|
| 1 | `wri_global_power_plant_database` | WRI Global Power Plant Database | https://datasets.wri.org/dataset/globalpowerplantdatabase | Power plants (geolocation, fuel type, capacity, country, owner/operator) | CSV | Creative Commons Attribution 4.0 (CC BY 4.0). Attribution required. | Annual (dataset updated yearly) | Download full CSV to `E:\god-eyes-data\energy\layer_10_energy_infrastructure\wri\raw\global_power_plant_database.csv` | Parse CSV, normalize fuel types, map to canonical categories, extract geometry from lat/lon | - Coverage varies by country (some regions incomplete)<br>- Capacity data may be outdated<br>- Owner/operator fields sometimes missing<br>- No transmission/substation data |
| 2 | `osm_energy_infrastructure` | OpenStreetMap Energy Infrastructure | https://www.openstreetmap.org/ (via Overpass API) | Power lines, substations, generators, pipelines where publicly mapped | XML/JSON (Overpass API) | Open Database License (ODbL). Attribution required. | Manual or periodic Overpass queries | Query Overpass API for energy infrastructure tags, store raw XML/JSON responses per region in `E:\god-eyes-data\energy\layer_10_energy_infrastructure\osm\raw\{region}.json` | Parse OSM XML/JSON, extract nodes/ways/relations with energy tags, map to canonical types, compute geometries | - Coverage depends on OSM volunteer mapping<br>- Data quality varies<br>- Overpass API rate limits<br>- Large regions need chunked queries<br>- No capacity/voltage data unless tagged |
| 3 | `global_energy_monitor_energy` | Global Energy Monitor | https://globalenergymonitor.org/ | Oil/gas pipelines, LNG terminals, major oil/gas terminals | CSV/JSON (if download available) | Creative Commons Attribution 4.0 (CC BY 4.0) for most datasets. Must verify license per dataset before use. | Semi-annual (dataset updates) | Download available datasets to `E:\god-eyes-data\energy\layer_10_energy_infrastructure\gem\raw\` | Parse CSV/JSON, normalize pipeline/terminal attributes, map to canonical types, extract geometries | - License must be verified per dataset<br>- Coverage may be incomplete<br>- Some datasets may require attribution<br>- No real-time flow data<br>- Pipeline routes may be approximate |

### Source Access Notes

1. **WRI Database**: Direct CSV download, no API key required. Must include attribution in UI.
2. **OpenStreetMap**: Use Overpass API with reasonable rate limits. For large-scale extraction, consider downloadable OSM extracts (e.g., Geofabrik). Do not depend on OpenInfraMap as a data API unless explicitly verified.
3. **Global Energy Monitor**: Check each dataset's license page before download. Some datasets may have restrictions.

## 5. Canonical Data Model

### Feature Types

| feature_type | Description | Geometry |
|--------------|-------------|----------|
| `power_plant` | Electricity generation facility | point |
| `substation` | Power transmission/distribution node | point |
| `transmission_line` | High-voltage power transmission line | line |
| `oil_pipeline` | Crude oil or refined product pipeline | line |
| `gas_pipeline` | Natural gas transmission pipeline | line |
| `lng_terminal` | Liquefied natural gas import/export terminal | point/polygon |
| `oil_terminal` | Crude oil or refined product storage/transfer terminal | point/polygon |
| `gas_terminal` | Natural gas storage/transfer terminal | point/polygon |
| `unknown_energy_feature` | Energy infrastructure with unclassified type | point/line/polygon |

### Geometry Types

| geometry_type | Description | Use Cases |
|---------------|-------------|-----------|
| `point` | Single coordinate (lat/lon) | Power plants, substations, terminals |
| `line` | Ordered list of coordinates | Transmission lines, pipelines |
| `polygon` | Closed ring of coordinates | Large terminals, power plant footprints (if available) |

### Canonical Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `layer_id` | VARCHAR(64) | NO | Always `layer_10_energy_infrastructure` |
| `source_id` | VARCHAR(64) | NO | Source identifier (see source list) |
| `source_object_id` | VARCHAR(256) | NO | Source-specific unique ID |
| `feature_type` | VARCHAR(32) | NO | One of the canonical feature types |
| `category` | VARCHAR(64) | NO | Human-readable category (e.g., "nuclear_power", "coal_power", "solar_power", "wind_power", "hydro_power", "gas_power", "oil_power", "substation", "transmission_line", "oil_pipeline", "gas_pipeline", "lng_terminal", "oil_terminal", "gas_terminal") |
| `name` | VARCHAR(512) | YES | Feature name (may be null if unnamed) |
| `operator` | VARCHAR(256) | YES | Operating company/organization |
| `owner` | VARCHAR(256) | YES | Owner company/organization (if different from operator) |
| `country` | VARCHAR(2) | YES | ISO 3166-1 alpha-2 country code |
| `status` | VARCHAR(32) | YES | Operational status (e.g., "operational", "planned", "decommissioned", "unknown") |
| `fuel_type` | VARCHAR(32) | YES | For power plants: "nuclear", "coal", "gas", "oil", "hydro", "solar", "wind", "biomass", "geothermal", "unknown" |
| `capacity_mw` | FLOAT | YES | Power plant capacity in megawatts |
| `voltage_kv` | FLOAT | YES | Transmission line voltage in kilovolts |
| `pipeline_product` | VARCHAR(32) | YES | For pipelines: "crude_oil", "refined_products", "natural_gas", "lng", "unknown" |
| `pipeline_length_km` | FLOAT | YES | Pipeline length in kilometers (if available) |
| `terminal_type` | VARCHAR(32) | YES | For terminals: "import", "export", "storage", "transfer", "unknown" |
| `geometry` | GEOMETRY(Geometry, 4326) | NO | PostGIS geometry column (point, line, polygon) |
| `centroid_lat` | FLOAT | NO | Latitude of geometry centroid |
| `centroid_lon` | FLOAT | NO | Longitude of geometry centroid |
| `bbox` | GEOMETRY(Geometry, 4326) | YES | Bounding box geometry (for spatial queries) |
| `source_confidence` | FLOAT | YES | Confidence score 0.0-1.0 (data quality indicator) |
| `source_updated_at` | TIMESTAMP | YES | When source data was last updated |
| `first_seen_at` | TIMESTAMP | NO | When this feature was first ingested |
| `last_seen_at` | TIMESTAMP | NO | When this feature was last seen in source data |
| `raw_source_json` | JSONB | YES | Raw source data for debugging/reprocessing |
| `created_at` | TIMESTAMP | NO | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | Record last update timestamp |

### Nullability Notes

- `name` is nullable because some infrastructure features are unnamed in source data.
- `operator`/`owner` are nullable because source data often lacks this information.
- `country` is nullable because some sources don't provide country codes.
- `status` is nullable because source data may not indicate operational status.
- `fuel_type` is only applicable to power plants; null for other feature types.
- `capacity_mw` is only applicable to power plants; null for other feature types.
- `voltage_kv` is only applicable to transmission lines/substations; null for other feature types.
- `pipeline_product` is only applicable to pipelines; null for other feature types.
- `pipeline_length_km` is only applicable to pipelines; null for other feature types.
- `terminal_type` is only applicable to terminals; null for other feature types.
- `source_confidence` is nullable when confidence cannot be determined.
- `source_updated_at` is nullable when source doesn't provide update timestamps.
- `raw_source_json` is nullable when raw data is too large or not stored.

## 6. Visual Rules

### Layer Default Behavior

- **Layer OFF by default** — user must toggle ON
- **Safe default category set**: power_plant, substation, transmission_line, gas_pipeline, lng_terminal (other categories hidden until user enables "Show all categories")
- **Browser-safe default cap**: 10,000 features maximum rendered initially; load more on zoom
- **No black/white primary marker colors** — use distinct colors for visibility on dark/light globe

### Color Scheme

| Category | Color | Hex | Notes |
|----------|-------|-----|-------|
| Nuclear power plant | Bright orange | #FF8C00 | Distinct, high-visibility |
| Coal power plant | Dark red | #8B0000 | Represents carbon intensity |
| Gas power plant | Orange-yellow | #FFA500 | Lighter than nuclear |
| Oil power plant | Brown | #8B4513 | Distinct from coal |
| Hydro power plant | Blue | #1E90FF | Water association |
| Solar power plant | Yellow | #FFD700 | Sun association |
| Wind power plant | Light green | #90EE90 | Air/breeze association |
| Biomass/Geothermal | Olive | #808000 | Earth tones |
| Substation | Purple | #9370DB | Distinct from generation |
| Transmission line | Light blue (dashed) | #ADD8E6 | Dashed line style |
| Oil pipeline | Red (solid) | #DC143C | Solid line style |
| Gas pipeline | Orange (solid) | #FF7F50 | Solid line style |
| LNG terminal | Pink | #FF69B4 | Distinctive for terminals |
| Oil terminal | Dark red (square) | #8B0000 | Square marker |
| Gas terminal | Orange (square) | #FFA500 | Square marker |
| Unknown energy feature | Gray | #808080 | Default/fallback |

### Marker Styles

| Geometry | Style | Size | Notes |
|----------|-------|------|-------|
| point (power plant) | Circle | 8px radius | Color by fuel_type |
| point (substation) | Diamond | 6px radius | Purple |
| point (terminal) | Square | 10px radius | Color by terminal type |
| line (transmission) | Dashed line | 2px width | Light blue |
| line (pipeline) | Solid line | 2px width | Color by product type |
| polygon (terminal) | Filled polygon | 30% opacity | Color by terminal type |

### UI Behavior

- Lines and points both render on globe
- Click feature → info overlay with all available metadata
- Hover tooltip shows name and type
- No heavy animation (static data)
- Existing layers (Aviation, Borders, Earth Events, Space) unaffected
- "Full/advanced mode" toggle can show more categories later

## 7. API Contract

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/energy/infrastructure` | List energy infrastructure features with filters |
| GET | `/api/energy/infrastructure/:featureId` | Get single feature details |
| GET | `/api/energy/infrastructure/categories` | List available categories with counts |
| GET | `/api/energy/infrastructure/sources` | List data sources with metadata |

**No WebSocket endpoint for MVP.**

**API Lane Owner:** DeepSeek V4 Flash

### Query Parameters (GET /api/energy/infrastructure)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 1000 | Max features to return |
| `bbox` | string | null | Bounding box "west,south,east,north" |
| `country` | string | null | ISO country code filter |
| `sourceId` | string | null | Source ID filter |
| `featureType` | string | null | Feature type filter |
| `category` | string | null | Category filter |
| `status` | string | null | Operational status filter |
| `fuelType` | string | null | Fuel type filter (power plants only) |
| `minCapacityMw` | float | null | Minimum capacity in MW |
| `maxCapacityMw` | float | null | Maximum capacity in MW |
| `minVoltageKv` | float | null | Minimum voltage in kV |
| `maxVoltageKv` | float | null | Maximum voltage in kV |
| `pipelineProduct` | string | null | Pipeline product type filter |

### Response Format (GET /api/energy/infrastructure)

```json
{
  "features": [
    {
      "id": "uuid",
      "layer_id": "layer_10_energy_infrastructure",
      "source_id": "wri_global_power_plant_database",
      "source_object_id": "WRI1000123",
      "feature_type": "power_plant",
      "category": "nuclear_power",
      "name": "Example Nuclear Plant",
      "operator": "Example Energy Corp",
      "owner": "Example Holdings",
      "country": "US",
      "status": "operational",
      "fuel_type": "nuclear",
      "capacity_mw": 1200.0,
      "voltage_kv": null,
      "pipeline_product": null,
      "pipeline_length_km": null,
      "terminal_type": null,
      "geometry": {
        "type": "Point",
        "coordinates": [-87.6298, 41.8781]
      },
      "centroid_lat": 41.8781,
      "centroid_lon": -87.6298,
      "source_confidence": 0.9,
      "source_updated_at": "2025-01-01T00:00:00Z",
      "first_seen_at": "2026-06-02T06:43:07Z",
      "last_seen_at": "2026-06-02T06:43:07Z"
    }
  ],
  "metadata": {
    "layerId": "layer_10_energy_infrastructure",
    "count": 50000,
    "returnedCount": 1000,
    "requestedLimit": 1000,
    "appliedLimit": 1000,
    "maxLimit": 10000,
    "activeFilters": {
      "bbox": null,
      "country": null,
      "sourceId": null,
      "featureType": null,
      "category": null,
      "status": null,
      "fuelType": null,
      "minCapacityMw": null,
      "maxCapacityMw": null,
      "minVoltageKv": null,
      "maxVoltageKv": null,
      "pipelineProduct": null
    },
    "generatedAt": "2026-06-02T06:43:07Z",
    "estimated": false,
    "staticData": true,
    "sourceSummary": {
      "wri_global_power_plant_database": {
        "featureCount": 35000,
        "lastUpdated": "2025-01-01T00:00:00Z"
      },
      "osm_energy_infrastructure": {
        "featureCount": 15000,
        "lastUpdated": "2026-05-01T00:00:00Z"
      },
      "global_energy_monitor_energy": {
        "featureCount": 5000,
        "lastUpdated": "2025-12-01T00:00:00Z"
      }
    }
  }
}
```

### Response Format (GET /api/energy/infrastructure/:featureId)

```json
{
  "id": "uuid",
  "layer_id": "layer_10_energy_infrastructure",
  "source_id": "wri_global_power_plant_database",
  "source_object_id": "WRI1000123",
  "feature_type": "power_plant",
  "category": "nuclear_power",
  "name": "Example Nuclear Plant",
  "operator": "Example Energy Corp",
  "owner": "Example Holdings",
  "country": "US",
  "status": "operational",
  "fuel_type": "nuclear",
  "capacity_mw": 1200.0,
  "voltage_kv": null,
  "pipeline_product": null,
  "pipeline_length_km": null,
  "terminal_type": null,
  "geometry": {
    "type": "Point",
    "coordinates": [-87.6298, 41.8781]
  },
  "centroid_lat": 41.8781,
  "centroid_lon": -87.6298,
  "bbox": null,
  "source_confidence": 0.9,
  "source_updated_at": "2025-01-01T00:00:00Z",
  "first_seen_at": "2026-06-02T06:43:07Z",
  "last_seen_at": "2026-06-02T06:43:07Z",
  "raw_source_json": { ... }
}
```

### Response Format (GET /api/energy/infrastructure/categories)

```json
{
  "categories": [
    { "name": "nuclear_power", "count": 450 },
    { "name": "coal_power", "count": 2500 },
    { "name": "gas_power", "count": 3000 },
    { "name": "oil_power", "count": 800 },
    { "name": "hydro_power", "count": 5000 },
    { "name": "solar_power", "count": 15000 },
    { "name": "wind_power", "count": 8000 },
    { "name": "biomass_power", "count": 1200 },
    { "name": "geothermal_power", "count": 200 },
    { "name": "substation", "count": 10000 },
    { "name": "transmission_line", "count": 5000 },
    { "name": "oil_pipeline", "count": 1500 },
    { "name": "gas_pipeline", "count": 2000 },
    { "name": "lng_terminal", "count": 300 },
    { "name": "oil_terminal", "count": 800 },
    { "name": "gas_terminal", "count": 600 },
    { "name": "unknown_energy_feature", "count": 500 }
  ]
}
```

### Response Format (GET /api/energy/infrastructure/sources)

```json
{
  "sources": [
    {
      "source_id": "wri_global_power_plant_database",
      "name": "WRI Global Power Plant Database",
      "homepage": "https://datasets.wri.org/dataset/globalpowerplantdatabase",
      "featureTypes": ["power_plant"],
      "featureCount": 35000,
      "lastUpdated": "2025-01-01T00:00:00Z",
      "license": "CC BY 4.0"
    },
    {
      "source_id": "osm_energy_infrastructure",
      "name": "OpenStreetMap Energy Infrastructure",
      "homepage": "https://www.openstreetmap.org/",
      "featureTypes": ["substation", "transmission_line", "power_plant", "oil_pipeline", "gas_pipeline"],
      "featureCount": 15000,
      "lastUpdated": "2026-05-01T00:00:00Z",
      "license": "ODbL"
    },
    {
      "source_id": "global_energy_monitor_energy",
      "name": "Global Energy Monitor",
      "homepage": "https://globalenergymonitor.org/",
      "featureTypes": ["oil_pipeline", "gas_pipeline", "lng_terminal", "oil_terminal", "gas_terminal"],
      "featureCount": 5000,
      "lastUpdated": "2025-12-01T00:00:00Z",
      "license": "CC BY 4.0"
    }
  ]
}
```

## 8. Database Lane Requirements

### Owner: Codex

### Deliverables

- Database migrations in `database/migrations/layers/layer_10_energy_infrastructure/`
- Table definitions with `layer_id` and `source_id`
- PostGIS geometry columns
- Indexes for performance
- Data tests in `tests/data/layer_10_energy_infrastructure/`
- No secrets in any files

### Schema Requirements

- PostGIS enabled
- Canonical energy infrastructure table (single table or split tables if justified)
- Geometry columns with SRID 4326
- Centroid columns (`centroid_lat`, `centroid_lon`)
- Bounding box support (`bbox` column)
- Indexes for:
  - `feature_type`
  - `category`
  - `source_id`
  - `country`
  - `fuel_type`
  - `status`
  - `capacity_mw`
  - `voltage_kv`
  - `geometry` (GiST index for spatial queries)
- Uniqueness strategy: composite unique constraint on (`source_id`, `source_object_id`)
- No destructive migration (additive only)
- Tests verifying constraints and indexes

### Table Structure

```sql
CREATE TABLE layer_10_energy_infrastructure.energy_infrastructure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id VARCHAR(64) DEFAULT 'layer_10_energy_infrastructure',
  source_id VARCHAR(64) NOT NULL,
  source_object_id VARCHAR(256) NOT NULL,
  
  -- Classification
  feature_type VARCHAR(32) NOT NULL,
  category VARCHAR(64) NOT NULL,
  
  -- Identification
  name VARCHAR(512),
  operator VARCHAR(256),
  owner VARCHAR(256),
  country VARCHAR(2),
  status VARCHAR(32),
  
  -- Power plant specific
  fuel_type VARCHAR(32),
  capacity_mw FLOAT,
  
  -- Transmission specific
  voltage_kv FLOAT,
  
  -- Pipeline specific
  pipeline_product VARCHAR(32),
  pipeline_length_km FLOAT,
  
  -- Terminal specific
  terminal_type VARCHAR(32),
  
  -- Geometry
  geometry GEOMETRY(Geometry, 4326) NOT NULL,
  centroid_lat FLOAT NOT NULL,
  centroid_lon FLOAT NOT NULL,
  bbox GEOMETRY(Geometry, 4326),
  
  -- Provenance
  source_confidence FLOAT,
  source_updated_at TIMESTAMP,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  raw_source_json JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uk_source_object UNIQUE (source_id, source_object_id)
);

-- Indexes
CREATE INDEX idx_energy_feature_type ON layer_10_energy_infrastructure.energy_infrastructure (feature_type);
CREATE INDEX idx_energy_category ON layer_10_energy_infrastructure.energy_infrastructure (category);
CREATE INDEX idx_energy_source_id ON layer_10_energy_infrastructure.energy_infrastructure (source_id);
CREATE INDEX idx_energy_country ON layer_10_energy_infrastructure.energy_infrastructure (country);
CREATE INDEX idx_energy_fuel_type ON layer_10_energy_infrastructure.energy_infrastructure (fuel_type);
CREATE INDEX idx_energy_status ON layer_10_energy_infrastructure.energy_infrastructure (status);
CREATE INDEX idx_energy_capacity_mw ON layer_10_energy_infrastructure.energy_infrastructure (capacity_mw);
CREATE INDEX idx_energy_voltage_kv ON layer_10_energy_infrastructure.energy_infrastructure (voltage_kv);
CREATE INDEX idx_energy_geometry ON layer_10_energy_infrastructure.energy_infrastructure USING GiST (geometry);
CREATE INDEX idx_energy_bbox ON layer_10_energy_infrastructure.energy_infrastructure USING GiST (bbox);
```

## 9. Fetching Lane Requirements

### Owner: MiniMax M3 (Fetching lane)

### Deliverables

- Fetcher implementations in `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/`
- Normalizer implementations in `services/normalizer/src/layers/layer_10_energy_infrastructure/`
- Source manifest
- Tests covering all components
- No secrets printed or committed

### CLI Interface

```
python -m services.fetch-orchestrator --layer layer_10_energy_infrastructure [options]

Options:
  --download-only          Download raw data without normalizing
  --normalize-only         Normalize previously downloaded data
  --persist-from-cache     Persist normalized data from local cache
  --source SOURCE_ID       Process only specified source
  --category CATEGORY      Process only specified category
  --country COUNTRY        Process only specified country (ISO code)
  --bbox BBOX              Process only features within bounding box (west,south,east,north)
  --max-features N         Limit number of features processed
  --dry-run                Show what would be done without making changes
```

### Source Cache Path

All raw data stored under: `E:\god-eyes-data\energy\layer_10_energy_infrastructure\`

Structure:
```
E:\god-eyes-data\energy\layer_10_energy_infrastructure\
├── wri\
│   └── raw\
│       └── global_power_plant_database.csv
├── osm\
│   └── raw\
│       ├── region_europe.json
│       ├── region_north_america.json
│       └── ...
└── gem\
    └── raw\
        ├── global_gas_infrastructure.csv
        ├── global_lng_infrastructure.csv
        └── ...
```

### Rules

- No raw data committed to git repository
- No API keys required for MVP (unless later approved)
- Graceful source failure handling (log error, continue with other sources)
- Source manifest required (documents each source's status, last successful fetch, error count)

## 10. Frontend Lane Requirements

### Owner: Qwen 3 (Frontend lane)

### Deliverables

- Energy Infrastructure layer component in `apps/web/src/layers/energy/infrastructure/`
- Layer toggle in LayerPanel
- Category filters
- Source filters
- Info overlay on feature selection
- Tests covering UI components

### UI Behavior

- **Energy Infrastructure layer toggle** in LayerPanel (OFF by default)
- **Category filters**: Multi-select for feature categories
- **Source filters**: Toggle visibility by data source
- **Safe default rendering**: Only show power_plant, substation, transmission_line, gas_pipeline, lng_terminal initially
- **Full/advanced mode optional**: Toggle to show all categories
- **Click feature → info overlay**: Show all available metadata
- **Lines and points both render**: Transmission lines and pipelines as lines, power plants/substations as points
- **No heavy animation**: Static data, no pulsing or movement
- **Existing layers unaffected**: Aviation, Borders, Earth Events, Space layers remain unchanged

### Visual Implementation

- Use Cesium entities for points (billboard or point graphics)
- Use Cesium polyline graphics for lines
- Color coding per visual rules in Section 6
- Hover tooltip with name and type
- Click handler opens detail panel

## 11. Security/Safety Rules

1. **Public/open data only** — no classified, secret, or non-public sources
2. **No secret sources** — all sources must be publicly documented
3. **No targeting/sabotage recommendations** — never suggest vulnerabilities or attack vectors
4. **No vulnerability scoring** — no CVSS or similar risk scoring
5. **No operational attack guidance** — no information that could aid infrastructure attacks
6. **No raw data committed** — all raw data stored outside git repository
7. **No .env committed** — environment variables never in version control
8. **No credentials printed** — API keys, passwords, tokens never logged or displayed
9. **Attribution required** — CC BY 4.0 and ODbL licenses require attribution in UI
10. **No real-time operational data** — static historical data only, no live grid status

## 12. Acceptance Criteria

The contract/spec is complete only if:

- [ ] All required docs exist:
  - [ ] `docs/control/layer_10_energy_infrastructure_mvp_contract.md` (this file)
  - [ ] `specs/004-layer-06-energy-infrastructure-mvp/spec.md`
  - [ ] `specs/004-layer-06-energy-infrastructure-mvp/plan.md`
  - [ ] `specs/004-layer-06-energy-infrastructure-mvp/tasks.md`
  - [ ] `docs/state/HANDOFF_LOG.md` updated
- [ ] `layer_id` and `source_ids` are stable
- [ ] MVP scope is clear
- [ ] Non-MVP items are explicitly deferred
- [ ] DB/API/fetching/frontend lane boundaries are clear
- [ ] Tests/build commands are listed
- [ ] Handoff log is updated
- [ ] One local commit is created
- [ ] Nothing is pushed

## 13. Validation Commands

```bash
# Build contracts
pnpm --filter @god-eyes/contracts build

# Build API
pnpm --filter api build

# Build frontend
pnpm --filter web build

# Run data tests
python -m pytest tests/data -q

# Check for uncommitted changes
git diff --check

# Check git status
git status --short
```

If tests fail for unrelated local-environment reasons, document exact failure and do not hide it.

## 14. Commit

Create exactly one local commit.

Commit message:
```
docs(energy): define layer 06 infrastructure contract
```

## 15. References

- WRI Global Power Plant Database: https://datasets.wri.org/dataset/globalpowerplantdatabase
- OpenStreetMap Energy Infrastructure: https://www.openstreetmap.org/
- Global Energy Monitor: https://globalenergymonitor.org/
- GOD EYES AGENTS.md: Control registry and multi-agent workflow
- GOD EYES MVP_LAYER_REGISTRY.md: Authoritative layer definitions
- GOD EYES LAYER_ARCHITECTURE.md: Layer architecture overview

---

**Specification Status**: ✅ Complete (specification only, no implementation)
**Last Updated**: 2026-06-02
**Agent**: Kimi 2.6 Free via OpenRouter (Spec/Contract Architect)
**Work Order**: WO-083A