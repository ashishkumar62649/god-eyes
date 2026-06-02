# Layer Architecture

## Concept

GOD EYES is built as a stack of visual layers on a 3D globe. Each layer represents a domain (aviation, satellite, maritime, etc.) and is independently developed, deployed, and toggled.

## Layer Registry

> **Note:** The authoritative layer registry is now `MVP_LAYER_REGISTRY.md`. This table is a summary; see the registry for full per-layer rules.

| # | Layer ID | Name | Description | MVP Status | Type |
|---|----------|------|-------------|------------|------|
| 0 | `layer_00_globe_core` | Globe Core | 3D globe, camera, base map, layer registry, selection system | active | static |
| 1 | `layer_01_aviation` | Aviation | Aircraft positions, airports, flight routes, details panel | active | live |
| 2 | `layer_02_borders_boundaries` | Borders & Boundaries | Country borders, administrative boundaries, disputed areas | active (MVP/local-dev) | static |
| 3 | `layer_03_earth_events` | Earth Events | Earthquakes, volcanic activity, weather alerts, natural disasters | active | live |
| 4 | `layer_04_public_military_security` | Public Military & Security | Public defense installations, open-source military data | coming_soon | static (MVP) |
| 5 | `layer_05_space_satellites` | Space & Satellites | Satellite objects, orbits, tracks, debris | coming_soon | live |
| 6 | `layer_06_maritime` | Maritime | Vessel positions, ports, vessel details | coming_soon | live |
| 7 | `layer_07_infrastructure` | Infrastructure | Power grids, fiber optics, water systems, transport networks | coming_soon | static |
| 8 | `layer_08_news_osint` | News & OSINT | Geotagged news, open-source intelligence feeds | coming_soon | live |
| 9 | `layer_09_user_shapes` | User Shapes | User-created polygons, lines, markers | coming_soon | static |
| 10 | `layer_10_energy_infrastructure` | Energy Infrastructure | Power plants, substations, transmission lines, oil/gas pipelines, LNG terminals | coming_soon | static |

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

First data layer. Proves the full pipeline from source â†’ raw â†’ normalized â†’ DB â†’ API â†’ frontend.

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

## Layer 2: Borders & Boundaries

Layer for rendering country borders, administrative boundaries, and disputed territories. MVP/local-dev rendering exists; production approval still requires boundary compliance review.

Components:
- Country border polygons
- Administrative boundary lines
- Disputed territory markers (with disclaimers)
- Static GeoJSON source (Natural Earth, UN)
- Single snapshot DB table

## Layer 3: Earth Events

Real-time natural event tracking from authoritative public feeds.

Components:
- Earthquake markers (USGS feed)
- Volcanic activity alerts
- Weather event overlays
- Timeline scrubber support
- Latest snapshot + history DB tables

## Layer 4: Public Military & Security (Coming Soon)

Public-only, static-only layer for open-source military and security data.

Components:
- Public defense installation markers
- Open-source military base locations
- Static markers only â€” no live tracking, no animation
- Read-only API â€” no write endpoints
- UI disclaimer: "Publicly available information only"

## Layer 5: Space & Satellites (Coming Soon)

Satellite tracking and orbital visualization.

Components:
- Satellite object markers
- Orbital path rendering (3D)
- TLE feed sources (Space-Track, CelesTrak)
- Latest snapshot + history DB tables

## Layer 6: Maritime (Coming Soon)

Vessel tracking and port database.

Components:
- Vessel position markers (heading-aware icons)
- Port markers
- Route lines
- AIS data feeds
- Latest snapshot + history DB tables

## Layer 7: Infrastructure (Coming Soon)

Critical infrastructure visualization from public datasets.

Components:
- Power grid line overlays
- Fiber optic cable routes
- Water system nodes
- Transportation network lines
- Static GeoJSON sources
- Single snapshot DB table

## Layer 8: News & OSINT (Coming Soon)

Geotagged news and open-source intelligence aggregation.

Components:
- News markers with headline display
- Expandable cards on click
- Timeline view
- RSS/API news feed fetchers
- Latest snapshot + history DB tables

## Layer 9: User Shapes (Coming Soon)

User-created geometry persisted across sessions.

Components:
- Draw polygon/line/marker tools
- Edit and delete controls
- Visibility toggle
- Authenticated write API
- User shapes DB table with user_id, geometry, properties

## Rules

1. A layer cannot depend on a higher-numbered layer.
2. All layers depend on Layer 0 (Globe Core).
3. Each layer is independently toggleable in the frontend.
4. Each data layer has its own source catalog, fetchers, normalizers, DB tables, and API endpoints.
