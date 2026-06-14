# Work Order: WO-047

**Assigned to:** Gemini CLI (Frontend)
**Layer:** layer_01_aviation
**Created:** 2026-05-19
**Status:** complete

## Objective

Implement the Airport Map Popup UI: a compact floating card anchored to the selected airport on the Cesium globe, connected to `GET /api/airports/:airportId/intelligence`, opening alongside the Intel panel when an airport is clicked.

## Layer Context

- Layer ID: `layer_01_aviation`
- Relevant spec: `specs/002-layer-one-aviation/spec.md`

## Inputs

- `GET /api/airports/:airportId/intelligence` — intelligence endpoint (API owner: Claude)
- `AirportObject` from `@god-eyes/contracts` — airport coordinates and base fields
- Existing `CesiumGlobe.tsx`, `App.tsx`, `Shell.tsx`, `DetailPanel.tsx`
- Existing `useAirportPublicProfile` hook as pattern reference

## Outputs

### Files Created
- `apps/web/src/lib/airportIntelligenceTypes.ts` — typed response shape for intelligence endpoint
- `apps/web/src/lib/useAirportIntelligence.ts` — data hook with abort/stale-response safety
- `apps/web/src/components/intel/AirportMapPopup.tsx` — map popup component

### Files Modified
- `apps/web/src/lib/api.ts` — added `getAirportIntelligence()`
- `apps/web/src/CesiumGlobe.tsx` — added `selectedAirport` prop, `SceneTransforms` screen-space tracking, popup render
- `apps/web/src/App.tsx` — passes `selectedObject` as `selectedAirport` to CesiumGlobe

## Acceptance Criteria

1. Clicking an airport dot shows a compact popup above the dot on the globe.
2. The Intel panel opens at the same time as the popup.
3. Popup reads from `GET /api/airports/:airportId/intelligence`.
4. Popup shows: airport image (with fallback), name, IATA/ICAO codes, city/country, short summary (max 2 lines), badges, opened date or "Not confirmed", runway count, longest runway.
5. Popup remains visible when user collapses the Intel panel.
6. Popup updates when another airport is selected.
7. Popup closes when airport selection is cleared (click empty globe or close button).
8. Loading state shows base name/codes immediately with a small spinner.
9. 404 → "Airport intelligence not found." 503/network → "Airport intelligence unavailable."
10. No fake capacity or passenger data invented.
11. No black screen. No console crash.
12. `pnpm --filter web build` passes.

## Constraints

- Do not touch `apps/api/`, `services/`, `database/`.
- Do not add new external source calls from frontend.
- Do not fake capacity or traffic data.
- Use API response only — no invented fields.
- Preserve existing fly-to and search selection behavior.
- Preserve existing Object Intel panel behavior.

## Popup Behavior

- Anchored to selected airport via `SceneTransforms.worldToWindowCoordinates`.
- Position updates on every `postRender` event (tracks camera movement).
- Rendered inside CesiumGlobe container div (position: absolute).
- Independent of Intel panel collapse state.
- Closes via close button or `onObjectSelect(null)`.

## Intel Panel Behavior

- Opens automatically when airport is selected (existing Shell.tsx `useEffect`).
- Does not force-reopen when user collapses.
- Reopens if user clicks Intel tab again (existing behavior).

## Dependencies

- `GET /api/airports/:airportId/intelligence` must be deployed (WO-043).
- `AirportObject` must include `latitude`/`longitude` or `location.latitude`/`location.longitude`.

## Known Limitations

- If `AirportObject` does not expose lat/lon fields at runtime, popup position will not render (graceful: popup simply does not appear). Full field audit deferred to integration review.
- Screen-space position is updated per-frame via `postRender`; on very slow devices this may cause minor jitter. Acceptable for MVP.
- Full infrastructure overlay (runway geometry on globe) is out of scope for this work order.
