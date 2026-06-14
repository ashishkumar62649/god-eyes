# WO-026: Object Intel Airport Detail API Integration

## Agent
OpenCode (deepseek-v4-flash-free)

## Branch
agent/opencode-web-1 (based on origin/main)

## Objective
Connect the right-side Object Intel panel to the existing Airport Detail API.
When a user selects an airport, fetch `GET /api/layers/layer_01_aviation/objects/:objectId/detail`
and display real aviation intelligence.

## Files Modified
| File | Change |
|------|--------|
| `apps/web/src/lib/api.ts` | Added `fetchAirportDetail()` + `AirportDetailResponse` import |
| `apps/web/src/App.tsx` | Added `airportDetail`/`detailLoading`/`detailError` state, `useRef` for AbortController + cache, `useEffect` on `selectedObject?.id`, pass new props to Shell |
| `apps/web/src/components/Shell.tsx` | Pass through `airportDetail`/`detailLoading`/`detailError` to DetailPanel |
| `apps/web/src/components/DetailPanel.tsx` | Replace `AviationDetailPlaceholders` with real sections, loading spinner, error state with preserved overview |

## Files Created
| File | Purpose |
|------|---------|
| `apps/web/src/components/intel/RunwaysSection.tsx` | Real runway data: ident, length, width, surface, LE/HE endpoints, CLOSED/LIGHTED badges, limit 10 |
| `apps/web/src/components/intel/FrequenciesSection.tsx` | Real frequency data: color-coded types, MHz, description, limit 10 |
| `apps/web/src/components/intel/NearbyNavaidsSection.tsx` | Real navaid data: VOR/NDB/TACAN icons, KHz/MHz formatting, distance in KM, limit 20 |
| `apps/web/src/components/intel/DataQualityCard.tsx` | Source system, runway/freq/navaid counts, generated timestamp, hides when all zero |

## Key Behaviors
1. `fetchAirportDetail()` with AbortSignal support for cancellation
2. AbortController cancels stale requests on fast airport switching
3. 5-minute in-memory cache avoids refetching same airport
4. Loading spinner in DetailPanel header during fetch
5. Error display keeps basic overview visible even if detail API fails
6. No null/undefined displayed, no fake data, no emojis

## Build Result
- Contracts build: PASS
- Web build: PASS (55 modules, 174.30 kB)
- API build: not touched

## Manual Browser Test Plan
1. Open http://localhost:5174
2. Search OMDB or Dubai
3. Click airport result → Object Intel opens → Runways show real data → Frequencies show real data → Nearby Navaids show real data → Data Quality/Provenance appears
4. Click cluster → zoom → airport dots appear → click dot → details load
5. Test VOMM and KORD
6. Stop API → detail panel shows graceful error
7. Restart API → details load again
8. No red fatal console errors

## Commit
```
feat(web): connect object intel to airport detail API
```

## Notes
- Does NOT modify: apps/api/, database/, services/, packages/contracts/, packages/schemas/
- Does NOT touch: AI/auth/live aircraft/new layers
- Reference branch `origin/agent/gemini-airport-detail-integration` inspected for patterns only
