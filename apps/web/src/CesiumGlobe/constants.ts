/**
 * constants.ts — Wave 4 CesiumGlobe split (W4-C)
 *
 * Pure module-level constants extracted from the orchestrator. Only
 * constants that were already declared at the top of the component
 * function body and have no viewer-lifecycle / hook-order coupling are
 * placed here.
 *
 * Constants that are declared INSIDE `useEffect` callback bodies
 * (`CHUNK_SIZE`, `DR_MAX_SECS`, `KNOTS_TO_MPS`, `FPM_TO_MPS`,
 * `FRAME_INTERVAL`, `R`) are intentionally NOT moved here in W4-C:
 * they are local-scope variables inside individual effects and moving
 * them would either require changing hook bodies or coupling them to
 * this module unnecessarily. Those will be moved (or inlined into
 * dedicated hooks) in their respective extraction packages
 * (W4-G live aircraft renderer).
 */

/**
 * Camera-height threshold (in metres) at which live aircraft billboards
 * switch from altitude-coloured DOTS to per-type ICON sprites.
 *
 * At <= 2 500 000 m the renderer shows aircraft type icons
 * (C-17, F-18, etc.) tinted by altitude band. Above that threshold
 * only altitude-coloured dots are shown to keep marker count manageable
 * when the camera is far from the surface.
 *
 * Used by:
 *   - `shouldShowAircraftIcons()` in `apps/web/src/CesiumGlobe/index.tsx`
 *   - `getAircraftVisualImage()` in the orchestrator
 *   - `updateAircraftVisualMode()` in the orchestrator
 */
export const AIRCRAFT_ICON_VIEW_HEIGHT_METERS = 2_500_000;
