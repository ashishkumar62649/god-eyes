# Specification: 004-Layer-10-Energy-Infrastructure-MVP

## Feature Identity
- **Spec ID**: 004-layer-10-energy-infrastructure-mvp
- **Layer ID**: layer_10_energy_infrastructure
- **Layer Name**: Energy Infrastructure
- **Phase**: MVP
- **Status**: Specification (not implemented)

---

## Executive Summary

The Energy Infrastructure MVP enables users to visualize public energy infrastructure across the globe, including power generation plants, transmission substations, high-voltage lines, oil/gas pipelines, and LNG terminals. This layer provides static, source-backed points, lines, and polygons for energy generation, transmission, and fossil fuel transport, using public open data sources.

---

## Primary User Value Proposition

Users can:
1. **Enable the Energy Infrastructure layer** on the GOD EYES globe
2. **See global energy infrastructure** categorized by type (power plants, substations, transmission lines, pipelines, terminals)
3. **Distinguish infrastructure types visually** with distinct colors and marker styles
4. **Filter and search** by category, source, country, fuel type, capacity, voltage, and pipeline product
5. **Click on any feature** to view its metadata: name, operator, owner, country, status, capacity, voltage, source, and data freshness
6. **Understand data provenance**—see which source provided the data and when it was last updated
7. **Explore energy infrastructure patterns** across regions and countries

---

## Feature Goals

### Must-Have (MVP)
- ✅ Render energy infrastructure features on Cesium globe
- ✅ Display power plants as colored circles (color by fuel type)
- ✅ Display substations as purple diamonds
- ✅ Display transmission lines as dashed light-blue lines
- ✅ Display oil pipelines as solid red lines
- ✅ Display gas pipelines as solid orange lines
- ✅ Display LNG terminals as pink markers
- ✅ Display oil/gas terminals as dark red/orange square markers
- ✅ Support category filters (power plant types, substations, transmission lines, pipelines, terminals)
- ✅ Support source filters (WRI, OSM, Global Energy Monitor)
- ✅ Show feature metadata in click panel
- ✅ Store normalized data in local database
- ✅ Provide API endpoints for frontend queries
- ✅ Use public open data sources only
- ✅ Include manual browser verification tests

### Nice-to-Have (Post-MVP)
- Live energy flow data (if publicly available)
- Advanced grid topology visualization
- Pipeline flow rate data
- Terminal inventory levels
- Historical infrastructure changes
- Capacity/voltage heatmaps
- Cross-infrastructure dependency analysis

### Explicitly Out of Scope
- ❌ Classified or secret energy infrastructure data
- ❌ Real-time grid balancing or operational data
- ❌ Vulnerability assessments or attack guidance
- ❌ Low-voltage distribution networks
- ❌ Individual consumer connections
- ❌ Energy pricing or market data
- ❌ Demand/supply forecasting
- ❌ Detailed pipeline flow rates
- ❌ Tank farm inventory levels
- ❌ Operational control data

---

## Data Truth Rule

**Energy infrastructure data is static and sourced from public open data.**

- Positions are derived from public databases (WRI, OpenStreetMap, Global Energy Monitor)
- UI may display data age/freshness to set user expectations
- **Never claim** real-time operational status or live flow data
- Data provenance is always displayed

---

## Visual Design Rules

### Marker Shapes
| Feature Type | Shape | Color | Notes |
|--------------|-------|-------|-------|
| Nuclear power plant | Circle | Bright orange (#FF8C00) | High-visibility |
| Coal power plant | Circle | Dark red (#8B0000) | Carbon intensity |
| Gas power plant | Circle | Orange-yellow (#FFA500) | Lighter than nuclear |
| Oil power plant | Circle | Brown (#8B4513) | Distinct from coal |
| Hydro power plant | Circle | Blue (#1E90FF) | Water association |
| Solar power plant | Circle | Yellow (#FFD700) | Sun association |
| Wind power plant | Circle | Light green (#90EE90) | Air/breeze association |
| Biomass/Geothermal | Circle | Olive (#808000) | Earth tones |
| Substation | Diamond | Purple (#9370DB) | Distinct from generation |
| Transmission line | Dashed line | Light blue (#ADD8E6) | 2px width |
| Oil pipeline | Solid line | Red (#DC143C) | 2px width |
| Gas pipeline | Solid line | Orange (#FF7F50) | 2px width |
| LNG terminal | Square | Pink (#FF69B4) | 10px radius |
| Oil terminal | Square | Dark red (#8B0000) | 10px radius |
| Gas terminal | Square | Orange (#FFA500) | 10px radius |
| Unknown energy feature | Circle | Gray (#808080) | Fallback |

### Layer Default Behavior
- **Layer OFF by default** — user must toggle ON
- **Safe default category set**: power_plant, substation, transmission_line, gas_pipeline, lng_terminal
- **Browser-safe default cap**: 10,000 features maximum rendered initially; load more on zoom
- **No black/white primary marker colors** — use distinct colors for visibility on dark/light globe
- **No heavy animation** — static data, no pulsing or movement

---

## Data Model Overview

### Core Entity: Energy Infrastructure Feature

An energy infrastructure feature represents a physical asset in the energy system.

```
EnergyInfrastructureFeature {
  id: uuid
  layer_id: 'layer_10_energy_infrastructure'
  source_id: 'wri_global_power_plant_database' | 'osm_energy_infrastructure' | 'global_energy_monitor_energy'
  source_object_id: string  // source-specific unique ID
  
  // Classification
  feature_type: 'power_plant' | 'substation' | 'transmission_line' | 'oil_pipeline' | 'gas_pipeline' | 'lng_terminal' | 'oil_terminal' | 'gas_terminal' | 'unknown_energy_feature'
  category: string  // e.g., 'nuclear_power', 'coal_power', 'solar_power', 'wind_power', 'hydro_power', 'substation', 'transmission_line', 'oil_pipeline', 'gas_pipeline', 'lng_terminal', 'oil_terminal', 'gas_terminal'
  
  // Identification
  name: string | null
  operator: string | null
  owner: string | null
  country: string | null  // ISO 3166-1 alpha-2
  status: string | null  // 'operational', 'planned', 'decommissioned', 'unknown'
  
  // Power plant specific
  fuel_type: string | null  // 'nuclear', 'coal', 'gas', 'oil', 'hydro', 'solar', 'wind', 'biomass', 'geothermal', 'unknown'
  capacity_mw: float | null
  
  // Transmission specific
  voltage_kv: float | null
  
  // Pipeline specific
  pipeline_product: string | null  // 'crude_oil', 'refined_products', 'natural_gas', 'lng', 'unknown'
  pipeline_length_km: float | null
  
  // Terminal specific
  terminal_type: string | null  // 'import', 'export', 'storage', 'transfer', 'unknown'
  
  // Geometry
  geometry: GEOMETRY(Geometry, 4326)  // point, line, or polygon
  centroid_lat: float
  centroid_lon: float
  bbox: GEOMETRY(Geometry, 4326) | null
  
  // Provenance
  source_confidence: float | null  // 0.0-1.0
  source_updated_at: timestamp | null
  first_seen_at: timestamp
  last_seen_at: timestamp
  raw_source_json: jsonb | null
  
  // Timestamps
  created_at: timestamp
  updated_at: timestamp
}
```

---

## API Contract Overview

### Primary Endpoints

#### 1. GET /api/energy/infrastructure
Fetch energy infrastructure features with optional filters.

**Query Parameters**:
- `limit` (optional): Max records, default 1000
- `bbox` (optional): Bounding box "west,south,east,north"
- `country` (optional): ISO country code filter
- `sourceId` (optional): Source ID filter
- `featureType` (optional): Feature type filter
- `category` (optional): Category filter
- `status` (optional): Operational status filter
- `fuelType` (optional): Fuel type filter (power plants only)
- `minCapacityMw` (optional): Minimum capacity in MW
- `maxCapacityMw` (optional): Maximum capacity in MW
- `minVoltageKv` (optional): Minimum voltage in kV
- `maxVoltageKv` (optional): Maximum voltage in kV
- `pipelineProduct` (optional): Pipeline product type filter

**Response**:
```json
{
  "features": [...],
  "metadata": {
    "layerId": "layer_10_energy_infrastructure",
    "count": 50000,
    "returnedCount": 1000,
    "requestedLimit": 1000,
    "appliedLimit": 1000,
    "maxLimit": 10000,
    "activeFilters": {...},
    "generatedAt": "2026-06-02T06:43:07Z",
    "estimated": false,
    "staticData": true,
    "sourceSummary": {...}
  }
}
```

#### 2. GET /api/energy/infrastructure/:featureId
Fetch detailed metadata for a single feature.

**Response**:
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
  "raw_source_json": {...}
}
```

#### 3. GET /api/energy/infrastructure/categories
Fetch list of available categories and counts.

**Response**:
```json
{
  "categories": [
    { "name": "nuclear_power", "count": 450 },
    { "name": "coal_power", "count": 2500 },
    ...
  ]
}
```

#### 4. GET /api/energy/infrastructure/sources
Fetch list of data sources with metadata.

**Response**:
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
    ...
  ]
}
```

---

## Frontend (Cesium) Requirements

### Layer Toggle & Visibility
- Add "Energy Infrastructure" to layer list
- Enable/disable rendering all energy features
- Load feature catalog on layer enable

### 3D Rendering
- Use Cesium `Entity` with `point` graphics for power plants, substations, terminals
- Use Cesium `Entity` with `polyline` graphics for transmission lines, pipelines
- Color by feature type/fuel type per visual rules
- Show feature name as label on hover
- Allow click to open detail panel

### Detail Panel
Display when user clicks a feature. Show:
- Name
- Feature Type
- Category
- Operator/Owner
- Country
- Status
- Fuel Type (if power plant)
- Capacity (MW) (if power plant)
- Voltage (kV) (if transmission line/substation)
- Pipeline Product (if pipeline)
- Pipeline Length (km) (if pipeline)
- Terminal Type (if terminal)
- Data Source
- Data Age/Freshness
- Last Updated Time

### Filters & Controls
- **Category Filter**: Multi-select (power plant types, substations, transmission lines, pipelines, terminals)
- **Source Filter**: Toggle visibility by data source (WRI, OSM, Global Energy Monitor)
- **Country Filter**: Filter by country code
- **Fuel Type Filter**: Filter power plants by fuel type
- **Capacity Range Slider**: Min/Max capacity in MW
- **Voltage Range Slider**: Min/Max voltage in kV
- **Pipeline Product Filter**: Filter pipelines by product type

---

## Database Schema Overview

### Core Table

#### `energy_infrastructure` (main table)
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

---

## Data Pipeline Overview

### Fetcher Lane
**Owner**: Codex (or designated fetching agent)

**Data Sources**:
1. **WRI Global Power Plant Database** (primary for power plants)
   - Endpoint: https://datasets.wri.org/dataset/globalpowerplantdatabase
   - Data: Global power plants with geolocation, fuel type, capacity
   - Frequency: Annual (dataset updated yearly)
   - No authentication required

2. **OpenStreetMap** (primary for transmission/pipelines)
   - Endpoint: Overpass API
   - Data: Power lines, substations, generators, pipelines
   - Frequency: Manual or periodic queries
   - No authentication required (rate limits apply)

3. **Global Energy Monitor** (primary for pipelines/terminals)
   - Endpoint: https://globalenergymonitor.org/
   - Data: Oil/gas pipelines, LNG terminals
   - Frequency: Semi-annual
   - No authentication required (license verification needed)

**Fetcher Responsibilities**:
- Fetch data from public sources
- Store raw data in local cache
- Handle source failures gracefully
- Track source freshness
- Call normalizer when new data arrives

### Normalizer Lane
**Owner**: Same as fetcher

**Normalizer Responsibilities**:
- Read raw data files
- Parse source-specific formats (CSV, XML, JSON)
- Map source fields to canonical schema
- Normalize geometry to PostGIS format
- Classify features into canonical types
- Call database lane with normalized data
- Store processed data in database

### Database Lane
**Owner**: Codex

**Responsibilities**:
- Create/migrate schema for `energy_infrastructure` table
- Ingest normalized features from normalizer
- Maintain spatial indexes
- Support spatial queries (bbox, distance)
- Provide schema documentation

### API Lane
**Owner**: Designated API agent

**Responsibilities**:
- Implement REST endpoints
- Query database for features
- Handle filtering, pagination, sorting
- Return JSON responses with metadata
- No WebSocket for MVP

### Frontend Lane
**Owner**: Designated frontend agent

**Responsibilities**:
- Build Cesium globe integration
- Render energy infrastructure features
- Connect to API endpoints
- Implement filters (category, source, country, fuel type, capacity, voltage)
- Build detail panel for feature metadata
- Support layer toggle

---

## Testing & Verification Strategy

### Manual Browser Verification (MVP)
1. Enable Energy Infrastructure layer
2. Verify power plants render as colored circles on globe
3. Verify substations render as purple diamonds
4. Verify transmission lines render as dashed light-blue lines
5. Verify pipelines render as solid colored lines
6. Verify terminals render as square markers
7. Click on a feature, verify detail panel shows all required fields
8. Apply filters (category, source, country), verify results update
9. Verify API responses match schema
10. Verify layer does not affect performance of other layers

### Data Quality Checks (Fetcher)
- Source format validation
- Geometry validation (valid coordinates)
- Field completeness checks
- Source freshness tracking
- Duplicate detection

### API Contract Tests
- All endpoints return correct schema
- Filters work as documented
- Pagination limits work
- Error handling for invalid requests
- Spatial queries work correctly

---

## Worktree & Branch Strategy

All agents work in parallel within their own worktrees and branches:

| Lane | Worktree | Branch | Owner |
|------|----------|--------|-------|
| Control/Integration | E:\god-eyes | agent/wo-083a-energy-infrastructure-contract | Kimi 2.6 (Spec Architect) |
| Database | E:\god-eyes-db | agent/wo-083b-energy-db | Codex |
| Fetcher/Normalizer | E:\god-eyes-fetching | agent/wo-083c-energy-fetching | Codex (or designated) |
| API | E:\god-eyes-api | agent/wo-083d-energy-api | Designated API agent |
| Frontend | E:\god-eyes-frontend | agent/wo-083e-energy-frontend | Designated frontend agent |
| Review | E:\god-eyes-review | agent/wo-083f-energy-review | Claude Haiku 4.5 |

Each agent:
- Creates one local commit per work order in their branch
- Updates `docs/state/HANDOFF_LOG.md` with metadata
- **Does NOT push** to remote
- **Kiro CLI** reviews, integrates, and pushes to main

---

## Post-MVP Enhancements

1. **Live Energy Flow Data**: If publicly available, add real-time grid status
2. **Advanced Grid Topology**: Show connections between power plants, substations, and transmission lines
3. **Pipeline Flow Rates**: Display flow rate data if available
4. **Terminal Inventory Levels**: Show storage levels if publicly reported
5. **Historical Changes**: Track infrastructure additions/decommissioning over time
6. **Capacity/Voltage Heatmaps**: Visualize capacity density and voltage distribution
7. **Cross-Infrastructure Dependencies**: Show how energy infrastructure connects to other systems
8. **User Annotations**: Allow users to add notes or bookmarks to infrastructure features

---

## Non-Functional Requirements

### Performance
- API responses for 10,000+ features < 500 ms
- Cesium rendering 5,000+ features smoothly (60 FPS on modern hardware)
- Spatial queries (bbox) < 200 ms
- Filter operations < 100 ms

### Reliability
- Graceful degradation if a source is unavailable
- Data freshness clearly communicated to user
- No data loss during source updates
- Rollback capability for bad data imports

### Security
- No API keys logged or printed
- No private/secret data exposed
- Public/open data sources only
- Attribution requirements met (CC BY 4.0, ODbL)

### Data Freshness
- Display "data age" to user (e.g., "WRI data is 1 year old")
- Use latest available data from each source
- If data older than 2 years, flag as "outdated"

---

## Success Criteria

✅ Layer renders on globe with correct visual design
✅ All features load and display metadata correctly
✅ Filters work as designed
✅ Detail panel shows all required fields
✅ API responses conform to schema
✅ Manual browser verification passes
✅ No API keys exposed
✅ Data age/freshness clearly communicated
✅ Existing layers (Aviation, Borders, Earth Events, Space) unaffected
✅ Spec completed without implementation

---

## References & Resources

- **WRI Global Power Plant Database**: https://datasets.wri.org/dataset/globalpowerplantdatabase
- **OpenStreetMap**: https://www.openstreetmap.org/
- **Overpass API**: https://wiki.openstreetmap.org/wiki/Overpass_API
- **Global Energy Monitor**: https://globalenergymonitor.org/
- **Cesium.js**: https://cesium.com/docs/cesiumjs-ref-doc/
- **PostGIS**: https://postgis.net/
- **GOD EYES AGENTS.md**: Control registry and multi-agent workflow
- **GOD EYES MVP_LAYER_REGISTRY.md**: Authoritative layer definitions

---

**Specification Status**: ✅ Complete (specification only, no implementation)
**Last Updated**: 2026-06-02
**Agent**: Kimi 2.6 Free via OpenRouter (Spec/Contract Architect)
**Work Order**: WO-083A