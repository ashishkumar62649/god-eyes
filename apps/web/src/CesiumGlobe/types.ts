/**
 * types.ts — Wave 4 CesiumGlobe split (W4-C)
 *
 * Type-only module that holds the orchestrator-local interfaces that
 * used to live at the top of `apps/web/src/CesiumGlobe.tsx`. All three
 * were previously declared inline in the original component file:
 *
 *   - `AviationStats`  — passed to App.tsx via `onAviationStatsChange`
 *   - `CesiumGlobeProps` — the public prop type for the default export
 *   - `AircraftRecord`  — internal per-aircraft record shape used by
 *                         the live-aircraft BillboardCollection map
 *
 * Why these three are safe to move:
 *   - They do not create circular imports (types.ts has no runtime
 *     deps and is only imported by index.tsx).
 *   - They depend on Cesium type-only symbols (`Billboard`, `Cartesian3`),
 *     React's `MutableRefObject`, contract types, and local layer
 *     types — all of which are already imported as `type` elsewhere.
 *
 * This module is type-only at the source level (no runtime exports).
 * Vite will tree-shake it to zero JS bytes in the production bundle.
 */

import type { Billboard, Cartesian3 } from 'cesium';
import type { MutableRefObject } from 'react';
import type {
  AircraftLatest,
  AirportObject,
  BordersBoundariesFeatureCollection,
  EarthEvent,
  MaritimeVesselObject,
  SpaceSatelliteItem,
} from '@god-eyes/contracts';

import type { AviationFilters } from '../layers/layer_01_aviation/airports/aviationCategories';
import type { SnapshotCallback } from '../layers/layer_01_aviation/aircraft/useLiveAircraftSocket';
import type { AirportLayoutFeaturesResponse } from '../layers/layer_01_aviation/airports/airportLayoutTypes';
import type { EnergyFeature } from '../layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureTypes';
import type { NewsRenderMarker } from '../layers/layer_08_news_osint/newsTypes';
import type { SatelliteFilters } from '../layers/layer_05_space_satellites/satellites/satelliteFilters';
import type { WeatherRenderItem } from '../layers/layer_07_weather/weatherTypes';

/**
 * Shape of the `aviationStats` payload that CesiumGlobe emits to the
 * `onAviationStatsChange` callback. Consumed by `apps/web/src/App.tsx`
 * to drive `aviationStats` state shown in the StatusPanel.
 */
export interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
  cacheEntries?: number;
  cacheHits?: number;
  cacheMisses?: number;
  inflight?: number;
  preloadStatus?: string;
  categoryCounts?: Record<string, number>;
}

/**
 * Public prop type for the `<CesiumGlobe>` default export.
 * Mounted by `apps/web/src/App.tsx` with 26 props (lines 204-237).
 */
export interface CesiumGlobeProps {
  aviationLayerActive: boolean;
  onObjectSelect: (obj: unknown) => void;
  onAviationStatsChange?: (stats: AviationStats) => void;
  cameraTarget?: {
    position: { latitude: number; longitude: number };
    type: string;
    timestamp: number;
  } | null;
  aviationFilters: AviationFilters;
  selectedAirport?: AirportObject | null;
  layoutFeatures?: AirportLayoutFeaturesResponse | null;
  earthEvents?: EarthEvent[];
  bordersData?: BordersBoundariesFeatureCollection | null;
  /** Callback ref: called by useLiveAircraftSocket with each new snapshot (no React re-render). */
  onAircraftSnapshot?: SnapshotCallback;
  onAircraftDelta?: (upsert: AircraftLatest[], removes: string[]) => void;
  /** Ref CesiumGlobe populates with the actual snapshot renderer function. */
  onSnapshotCbRef?: MutableRefObject<SnapshotCallback | undefined>;
  /** Ref CesiumGlobe populates with the actual delta renderer function. */
  onDeltaCbRef?: MutableRefObject<
    ((upsert: AircraftLatest[], removes: string[]) => void) | undefined
  >;
  /** Called by the renderer to report rendered count back to the hook/status. */
  onAircraftRendered?: (count: number) => void;
  liveAircraftLayerActive?: boolean;
  /** Returns current camera bbox as [minLon,minLat,maxLon,maxLat], or null for global fallback. */
  onGetBbox?: () => [number, number, number, number] | null;
  /** Ref that CesiumGlobe populates with its bbox getter (for WS bbox updates). */
  onGetBboxRef?: MutableRefObject<
    (() => [number, number, number, number] | null) | undefined
  >;
  /** Layer 05: Space & Satellites */
  spaceSatellites?: SpaceSatelliteItem[];
  spaceSatellitesLayerActive?: boolean;
  spaceSatelliteFilters?: SatelliteFilters;
  /** Layer 10: Energy Infrastructure */
  energyInfrastructureFeatures?: EnergyFeature[];
  energyInfrastructureLayerActive?: boolean;
  onEnergyFeatureSelect?: (feature: EnergyFeature | null) => void;
  maritimeLayerActive?: boolean;
  maritimeVessels?: MaritimeVesselObject[];
  onMaritimeBboxChange?: (bbox: string | null) => void;
  /** Layer 07: Weather */
  weatherLayerActive?: boolean;
  weatherItems?: WeatherRenderItem[];
  onWeatherSelect?: (item: WeatherRenderItem | null) => void;
  /** Layer 08: News & OSINT */
  newsLayerActive?: boolean;
  newsMarkers?: NewsRenderMarker[];
  onNewsSelect?: (item: NewsRenderMarker | null) => void;
}

/**
 * Per-aircraft record stored in `aircraftMapRef` (a
 * `Map<sourceObjectId, AircraftRecord>`). Used by both the snapshot
 * apply loop and the dead-reckoning rAF loop. The billboard reference
 * is the live `Billboard` from Cesium; the other fields are
 * display-only dead-reckoning state.
 *
 * `AircraftRecord` is an internal type; it is NOT part of the public
 * CesiumGlobe API.
 */
export interface AircraftRecord {
  billboard: Billboard;
  currLat: number;
  currLon: number;
  currAltM: number;
  currPos: Cartesian3;
  currTime: number;
  staleAfter: number;
  // Dead reckoning fields (display-only, never written back as real data).
  speedKt: number; // 0 = unknown/ground
  trackDeg: number; // NaN = unknown
  verticalRateFpm: number; // 0 = unknown
  onGround: boolean;
}
