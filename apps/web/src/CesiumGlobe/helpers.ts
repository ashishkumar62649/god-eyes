/**
 * helpers.ts — Wave 4 CesiumGlobe split (W4-C)
 *
 * Pure helper functions extracted from the CesiumGlobe orchestrator.
 * Only helpers that are free of orchestrator-scope refs / state / hook
 * coupling are placed here.
 *
 * Helpers that are INTENTIONALLY NOT moved in W4-C (they read or write
 * orchestrator-scoped refs and require viewer-lifecycle state):
 *
 *   - `emitStats`                  — reads `globalDotCollectionRef`,
 *                                    `fpsRef`, calls `onStatsChangeRef`
 *   - `applyFiltersToDots`         — reads `globalDotCollectionRef`,
 *                                    `viewerRef`, `aviationFiltersRef`,
 *                                    `residentCacheActiveRef`
 *   - `shouldShowAircraftIcons`    — reads `cameraHeightRef`
 *   - `getAircraftVisualImage`     — calls `shouldShowAircraftIcons`
 *   - `updateAircraftVisualMode`   — mutates `aircraftMapRef`,
 *                                    calls `getAircraftMarkerImageAsync`
 *   - `startResidentPreload`       — orchestrates the full cache
 *                                    preload state machine
 *
 * Those will be extracted (or co-located with their owning hooks) in
 * W4-G (live aircraft renderer) and W4-E (resident aviation cache)
 * once the orchestrator exposes the refs those hooks will receive as
 * parameters.
 */

/**
 * Returns the target fly-to height (in metres) for an airport overview
 * after a search-result selection or a global-dot click.
 *
 * Rules:
 *   - If the current camera height is already closer (lower) than the
 *     target, stay at the current height — never zoom OUT to a worse
 *     overview.
 *   - Otherwise, fly to 12 000 m — frames a typical airport / runway
 *     area without zooming all the way down to city-level detail.
 *
 * The `TARGET = 12_000` constant is the canonical "airport overview"
 * altitude used by both the search-result `useEffect` (camera fly-to)
 * and the click handler's global-dot branch.
 */
export function airportFlyHeight(currentHeight?: number): number {
  const TARGET = 12_000; // metres — whole airport visible, not city/state level
  if (currentHeight !== undefined && currentHeight < TARGET) {
    return currentHeight; // already close — don't zoom out
  }
  return TARGET;
}
