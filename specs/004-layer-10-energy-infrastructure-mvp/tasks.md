# Task Breakdown: 004-Layer-06-Energy-Infrastructure-MVP

## Database Lane Tasks (Codex)

### Task DB-1: Schema Design
- [ ] Review canonical data model from contract
- [ ] Design PostGIS table structure
- [ ] Define indexes for performance
- [ ] Define uniqueness constraints
- [ ] Create migration script

### Task DB-2: Migration Implementation
- [ ] Create migration directory `database/migrations/layers/layer_10_energy_infrastructure/`
- [ ] Write SQL migration for `energy_infrastructure` table
- [ ] Add spatial indexes (GiST)
- [ ] Add attribute indexes
- [ ] Test migration on clean database

### Task DB-3: Data Tests
- [ ] Create test directory `tests/data/layer_10_energy_infrastructure/`
- [ ] Write tests for schema constraints
- [ ] Write tests for index existence
- [ ] Write tests for spatial queries
- [ ] Verify tests pass

### Task DB-4: Schema Documentation
- [ ] Document table structure
- [ ] Document index strategy
- [ ] Document query patterns

## Fetching Lane Tasks (Codex or designated agent)

### Task FETCH-1: Source Research
- [ ] Verify WRI database download URL and format
- [ ] Verify OSM Overpass API query patterns for energy infrastructure
- [ ] Verify Global Energy Monitor datasets and licenses
- [ ] Document source access procedures

### Task FETCH-2: Fetcher Implementation
- [ ] Create fetcher directory `services/fetch-orchestrator/src/layers/layer_10_energy_infrastructure/`
- [ ] Implement WRI CSV fetcher
- [ ] Implement OSM Overpass fetcher
- [ ] Implement Global Energy Monitor fetcher
- [ ] Implement source manifest tracking

### Task FETCH-3: Normalizer Implementation
- [ ] Create normalizer directory `services/normalizer/src/layers/layer_10_energy_infrastructure/`
- [ ] Implement WRI CSV normalizer
- [ ] Implement OSM XML/JSON normalizer
- [ ] Implement Global Energy Monitor normalizer
- [ ] Implement geometry normalization

### Task FETCH-4: CLI Interface
- [ ] Implement `--download-only` mode
- [ ] Implement `--normalize-only` mode
- [ ] Implement `--persist-from-cache` mode
- [ ] Implement `--source` filter
- [ ] Implement `--category` filter
- [ ] Implement `--country` filter
- [ ] Implement `--bbox` filter
- [ ] Implement `--max-features` limit

### Task FETCH-5: Testing
- [ ] Write unit tests for fetchers
- [ ] Write unit tests for normalizers
- [ ] Write integration tests for full pipeline
- [ ] Test source failure handling

## API Lane Tasks (Designated API agent)

### Task API-1: Endpoint Implementation
- [ ] Create API route directory `apps/api/src/routes/energy/`
- [ ] Implement `GET /api/energy/infrastructure` endpoint
- [ ] Implement `GET /api/energy/infrastructure/:featureId` endpoint
- [ ] Implement `GET /api/energy/infrastructure/categories` endpoint
- [ ] Implement `GET /api/energy/infrastructure/sources` endpoint

### Task API-2: Query Processing
- [ ] Implement bbox spatial filter
- [ ] Implement attribute filters (country, source, featureType, category, status, fuelType)
- [ ] Implement range filters (capacity, voltage)
- [ ] Implement pagination (limit, offset)
- [ ] Implement response metadata

### Task API-3: Testing
- [ ] Write endpoint tests
- [ ] Write filter tests
- [ ] Write spatial query tests
- [ ] Write error handling tests

## Frontend Lane Tasks (Designated frontend agent)

### Task FE-1: Layer Component
- [ ] Create layer directory `apps/web/src/layers/energy/infrastructure/`
- [ ] Implement EnergyInfrastructureLayer component
- [ ] Implement layer toggle in LayerPanel
- [ ] Implement category filters
- [ ] Implement source filters

### Task FE-2: Cesium Rendering
- [ ] Implement point rendering (power plants, substations, terminals)
- [ ] Implement line rendering (transmission lines, pipelines)
- [ ] Implement color scheme per visual rules
- [ ] Implement hover tooltips
- [ ] Implement click handlers

### Task FE-3: Detail Panel
- [ ] Implement EnergyInfrastructureInfoOverlay component
- [ ] Display all feature metadata
- [ ] Show data source and freshness
- [ ] Handle null fields gracefully

### Task FE-4: API Integration
- [ ] Connect to API endpoints
- [ ] Implement data loading with pagination
- [ ] Handle loading states
- [ ] Handle error states

### Task FE-5: Testing
- [ ] Write component tests
- [ ] Write rendering tests
- [ ] Manual browser verification

## Integration & Review Tasks

### Task REVIEW-1: Cross-Lane Verification
- [ ] Verify database schema matches API expectations
- [ ] Verify fetching output matches database schema
- [ ] Verify API responses match frontend expectations
- [ ] Verify visual rules match contract

### Task REVIEW-2: Performance Testing
- [ ] Test API response times
- [ ] Test frontend rendering performance
- [ ] Test spatial query performance
- [ ] Test with large datasets

### Task REVIEW-3: Security Review
- [ ] Verify no secrets in code
- [ ] Verify public data sources only
- [ ] Verify attribution requirements met
- [ ] Verify no targeting/sabotage guidance

## Documentation Tasks

### Task DOC-1: Handoff Log
- [ ] Update `docs/state/HANDOFF_LOG.md` with contract work
- [ ] Include model/time metadata
- [ ] Document files created/modified

### Task DOC-2: Control Documents
- [ ] Update `docs/control/layer_10_energy_infrastructure_mvp_contract.md`
- [ ] Update `docs/control/MVP_LAYER_REGISTRY.md` (if needed)
- [ ] Update `docs/control/LAYER_ARCHITECTURE.md` (if needed)

## Completion Criteria

- [ ] All database tasks complete
- [ ] All fetching tasks complete
- [ ] All API tasks complete
- [ ] All frontend tasks complete
- [ ] Integration review passes
- [ ] Performance requirements met
- [ ] Security/safety rules followed
- [ ] Documentation updated
- [ ] One local commit created
- [ ] Nothing pushed to remote