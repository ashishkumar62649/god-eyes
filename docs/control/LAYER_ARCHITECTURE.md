# Layer Architecture

## Concept

GOD EYES is built as a stack of visual layers on a 3D globe. Each layer represents a domain (aviation, satellite, maritime, etc.) and is independently developed, deployed, and toggled.

## Layer Registry

| Layer ID | Name | Description | Status |
|----------|------|-------------|--------|
| `layer_00_globe_core` | Globe Core | 3D globe, camera, base map, layer registry, selection system | Next |
| `layer_01_aviation` | Aviation | Aircraft positions, airports, flight routes, details panel | Next |
| `layer_02_satellite` | Satellite | Satellite objects, orbits, tracks | Future |
| `layer_03_maritime` | Maritime | Vessel positions, ports, vessel details | Future |
| `layer_04_weather_disasters` | Weather/Disasters | Weather alerts, natural disasters | Future |
| `layer_05_cyber_infrastructure` | Cyber/Infrastructure | Network infrastructure, cyber events | Future |
| `layer_06_ai_intelligence` | AI Intelligence | AI-generated reports, pattern detection | Future |

## Layer 0: Globe Core

Foundation layer. All other layers render on top of this.

Components:
- 3D globe rendering
- Camera controls (zoom, pan, rotate, fly-to)
- Base map/terrain/imagery provider abstraction
- Layer registry and toggle system
- Timeline/time control placeholder
- Event/object selection system
- Frontend map contract

## Layer 1: Aviation

First data layer. Proves the full pipeline from source → raw → normalized → DB → API → frontend.

Components:
- Aircraft position layer (map markers)
- Airports layer
- Flight routes
- Aircraft details panel
- Aviation source catalog
- Aviation raw data location rules
- Aviation normalizer contract
- Aviation database tables
- Aviation API endpoints
- Aviation frontend layer folder

## Layer 2: Satellite (Future)

- Satellite objects
- Satellite orbits/tracks
- Satellite source catalog
- Satellite raw data rules
- Satellite frontend layer

## Layer 3: Maritime (Future)

- Vessel positions
- Ports
- Vessel detail panel
- Maritime source catalog
- Maritime raw data rules
- Maritime frontend layer

## Later Layers (Future)

- Weather/Disasters
- Cyber/Infrastructure
- AI Intelligence/Reports

## Rules

1. A layer cannot depend on a higher-numbered layer.
2. All layers depend on Layer 0 (Globe Core).
3. Each layer is independently toggleable in the frontend.
4. Each data layer has its own source catalog, fetchers, normalizers, DB tables, and API endpoints.
