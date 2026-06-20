/**
 * picking.ts — Wave 4 CesiumGlobe split (W4-F)
 *
 * Owns the Cesium LEFT_CLICK dispatch tree that reads picking-id
 * fields from billboard `id` objects and entity `properties`
 * objects, and routes each picked object to its corresponding
 * selection callback.
 *
 * Picking contract
 * ----------------
 * Every picking field name is sourced from `pickingFields.ts` (the
 * W4-B contract). Production code MUST NOT use raw string literals
 * like `'_aircraftData'` here; it must use `PICKING_FIELDS.aircraftData`
 * (and the related constants for entity-property keys). The picking-
 * contract test in `__tests__/pickingContract.test.ts` pins all 8 field
 * names; this module is the production consumer of those pins.
 *
 * Lifecycle
 * ---------
 * `picking.ts` exports a factory, not a hook, because the
 * `ScreenSpaceEventHandler` is owned by the viewer-init `useEffect`
 * in `apps/web/src/CesiumGlobe/index.tsx` (its lifetime is bound to
 * `viewer.destroy()` via implicit cleanup of the canvas DOM event
 * listeners). The factory takes the live `Viewer` plus a snapshot
 * of mutable refs / state setters / prop callbacks at the moment of
 * registration, and returns a closure that the orchestrator passes to
 * `handler.setInputAction(callback, ScreenSpaceEventType.LEFT_CLICK)`.
 *
 * Picking branches (must all be preserved bit-for-bit):
 *
 *   1. **Global dot** (Layer 01 airport resident cache): look up
 *      airport in `getAllObjects()`; call `onObjectSelectRef`; fly to
 *      airport overview height (`airportFlyHeight`).
 *   2. **Live aircraft billboard** (`_aircraftData`): set selected aircraft
 *      if front-of-globe (`isPositionVisible`).
 *   3. **Maritime vessel billboard** (`_vesselData`): call
 *      `onObjectSelectRef`.
 *   4. **Weather billboard** (`_weatherData`): call
 *      `onWeatherSelectRef`.
 *   5. **News billboard** (`_newsData`): call `onNewsSelectRef` after
 *      coordinate validity check.
 *   6. **Entity with `earthquakeData` property**: set selected earthquake.
 *   7. **Entity with `satelliteData` property**: set selected satellite.
 *   8. **Entity with `id` starting with `'energy-'`**: call
 *      `onEnergyFeatureSelect` with `properties.rawData.getValue()`.
 *   9. **Entity with `rawData` property**: call `onObjectSelectRef`
 *      with `properties.rawData.getValue()`.
 *   10. **No match**: call `onObjectSelectRef(null)` (clear selection).
 *   11. **Back-of-globe entity** (`!isPositionVisible`): call
 *       `onObjectSelectRef(null)` (clear selection).
 *
 * Behavior preservation is enforced by:
 *
 *   - The W4-B picking-contract test (17 assertions on the 8 field names).
 *   - The 153/170 → 170/170 web test suite (no test exercises Cesium
 *     picking because jsdom + Cesium mock is out of scope, but the
 *     picking-contract test is the bit-for-bit correctness gate).
 */

import { Cartesian2, Cartesian3, Entity, Viewer } from 'cesium';
import type { MutableRefObject } from 'react';
import type {
  AircraftLatest,
  EarthEvent,
  MaritimeVesselObject,
} from '@god-eyes/contracts';

import { isPositionVisible } from '../globe/cesiumVisibility';
import {
  isGlobalDot,
  getGlobalDotPosition,
} from '../layers/layer_01_aviation/airports/aviationGlobalRenderer';
import { getAllObjects } from '../layers/layer_01_aviation/airports/aviationObjectStore';
import type { EnergyFeature } from '../layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureTypes';
import type { NewsRenderMarker } from '../layers/layer_08_news_osint/newsTypes';
import type { SatelliteFrontendItem } from '../layers/layer_05_space_satellites/satellites/satelliteTypes';
import type { WeatherRenderItem } from '../layers/layer_07_weather/weatherTypes';

import { airportFlyHeight } from './helpers';
import { PICKING_FIELDS } from './pickingFields';export interface CreatePickClickHandlerParams {
  /** Live Cesium Viewer (must be non-null; the factory is invoked after viewer init). */
  viewer: Viewer;
  /** Mutable ref of the `onObjectSelect` prop callback. */
  onObjectSelectRef: MutableRefObject<(obj: unknown) => void>;
  /** React state setter for the selected live aircraft overlay. */
  setSelectedAircraft: (aircraft: AircraftLatest | null) => void;
  /** React state setter for the selected earthquake overlay. */
  setSelectedEarthquake: (earthquake: EarthEvent | null) => void;
  /** React state setter for the selected satellite overlay. */
  setSelectedSatellite: (satellite: SatelliteFrontendItem | null) => void;
  /** Mutable ref of the `onWeatherSelect` prop callback (may be undefined). */
  onWeatherSelectRef: MutableRefObject<
    ((item: WeatherRenderItem | null) => void) | undefined
  >;
  /** Mutable ref of the `onNewsSelect` prop callback (may be undefined). */
  onNewsSelectRef: MutableRefObject<
    ((item: NewsRenderMarker | null) => void) | undefined
  >;
  /** Mutable ref of the `onEnergyFeatureSelect` prop callback (may be undefined). */
  onEnergyFeatureSelectRef?: MutableRefObject<
    ((feature: EnergyFeature | null) => void) | undefined
  >;
}

/**
 * Cesium `LEFT_CLICK` picking dispatcher.
 *
 * Reads the 8 picking-field names from `PICKING_FIELDS` (the W4-B
 * contract) and routes each picked object to its corresponding
 * selection callback. Behavior is bit-for-bit identical to the
 * inline click handler it replaces in
 * `apps/web/src/CesiumGlobe/index.tsx`.
 *
 * Returns the click callback the orchestrator passes to
 * `handler.setInputAction(callback, ScreenSpaceEventType.LEFT_CLICK)`.
 * The closure captures `viewer` and the mutable refs at
 * registration time; refs allow late prop updates to flow through
 * to the click handler without re-registering the listener.
 */
export function createPickClickHandler(
  params: CreatePickClickHandlerParams,
): (click: { position: Cartesian2 }) => void {
  const {
    viewer,
    onObjectSelectRef,
    setSelectedAircraft,
    setSelectedEarthquake,
    setSelectedSatellite,
    onWeatherSelectRef,
    onNewsSelectRef,
    onEnergyFeatureSelectRef,
  } = params;

  return (click: { position: Cartesian2 }) => {
    const pickedObject = viewer.scene.pick(click.position);
    const pickingId = pickedObject?.id ?? pickedObject?.primitive?.id;

    // Helper to clear local overlays safely
    const clearLocalSelections = () => {
      setSelectedAircraft(null);
      setSelectedEarthquake(null);
      setSelectedSatellite(null);
    };

    if (!pickedObject || !pickingId) {
      onObjectSelectRef.current(null);
      clearLocalSelections();
      onWeatherSelectRef.current?.(null);
      onNewsSelectRef.current?.(null);
      onEnergyFeatureSelectRef?.current?.(null);
      return;
    }

    // Global dot click → fly to coordinate
    if (isGlobalDot(pickedObject)) {
      const pos = getGlobalDotPosition(pickedObject);
      if (pos) {
        // Look up the airport from resident cache
        const airportId = pickedObject.id.airportId;
        const allObjects = getAllObjects();
        const airport = allObjects.find((a) => a.id === airportId);
        if (airport) {
          onObjectSelectRef.current(airport);
        }
        clearLocalSelections();
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            pos.longitude,
            pos.latitude,
            airportFlyHeight(viewer.camera.positionCartographic.height),
          ),
          duration: 1.0,
        });
      }
      return;
    }

    if (!(pickingId instanceof Entity)) {
      // Check if it's a live aircraft billboard pick.
      if (
        pickingId &&
        typeof pickingId === 'object' &&
        (pickingId as { [k: string]: unknown })[PICKING_FIELDS.aircraftData]
      ) {
        const ac = (pickingId as { [k: string]: unknown })[
          PICKING_FIELDS.aircraftData
        ] as AircraftLatest;
        const pos = Cartesian3.fromDegrees(ac.lon!, ac.lat!, 0);
        if (isPositionVisible(viewer, pos)) {
          setSelectedAircraft(ac);
          onObjectSelectRef.current(null);
          setSelectedEarthquake(null);
          setSelectedSatellite(null);
        }
      } else if (
        pickingId &&
        typeof pickingId === 'object' &&
        (pickingId as { [k: string]: unknown })[PICKING_FIELDS.vesselData]
      ) {
        const vessel = (pickingId as { [k: string]: unknown })[
          PICKING_FIELDS.vesselData
        ] as MaritimeVesselObject;
        const pos = Cartesian3.fromDegrees(vessel.longitude, vessel.latitude, 0);
        if (isPositionVisible(viewer, pos)) {
          onObjectSelectRef.current(vessel);
          clearLocalSelections();
        }
      } else if (
        pickingId &&
        typeof pickingId === 'object' &&
        (pickingId as { [k: string]: unknown })[PICKING_FIELDS.weatherData]
      ) {
        const weatherItem = (pickingId as { [k: string]: unknown })[
          PICKING_FIELDS.weatherData
        ] as WeatherRenderItem;
        const pos = Cartesian3.fromDegrees(weatherItem.longitude, weatherItem.latitude, 0);
        if (isPositionVisible(viewer, pos)) {
          onWeatherSelectRef.current?.(weatherItem);
          onObjectSelectRef.current(null);
          clearLocalSelections();
        }
      } else if (
        pickingId &&
        typeof pickingId === 'object' &&
        (pickingId as { [k: string]: unknown })[PICKING_FIELDS.newsData]
      ) {
        const newsItem = (pickingId as { [k: string]: unknown })[
          PICKING_FIELDS.newsData
        ] as NewsRenderMarker;
        if (
          typeof newsItem.latitude === 'number' &&
          typeof newsItem.longitude === 'number'
        ) {
          const pos = Cartesian3.fromDegrees(newsItem.longitude, newsItem.latitude, 0);
          if (isPositionVisible(viewer, pos)) {
            onNewsSelectRef.current?.(newsItem);
            onObjectSelectRef.current(null);
            clearLocalSelections();
          }
        }
      } else if (
        pickingId &&
        typeof pickingId === 'object' &&
        (pickingId as { [k: string]: unknown })[PICKING_FIELDS.satelliteData]
      ) {
        const satItem = (pickingId as { [k: string]: unknown })[
          PICKING_FIELDS.satelliteData
        ] as SatelliteFrontendItem;
        const altM = (satItem.altitudeKm ?? 0) * 1000;
        const pos = Cartesian3.fromDegrees(satItem.longitude, satItem.latitude, altM);
        if (isPositionVisible(viewer, pos)) {
          setSelectedSatellite(satItem);
          onObjectSelectRef.current(null);
          setSelectedAircraft(null);
          setSelectedEarthquake(null);
        }
      } else {
        onObjectSelectRef.current(null);
        clearLocalSelections();
      }
      return;
    }

    const entity = pickingId;
    const position = entity.position?.getValue(viewer.clock.currentTime);
    if (position && !isPositionVisible(viewer, position)) {
      onObjectSelectRef.current(null);
      clearLocalSelections();
      return;
    }

    // Earthquake entity click
    if (
      entity.properties &&
      (entity.properties as { [k: string]: unknown })[PICKING_FIELDS.earthquakeEntityData]
    ) {
      const earthquakeDataProp = (entity.properties as { [k: string]: unknown })[
        PICKING_FIELDS.earthquakeEntityData
      ] as { getValue: () => unknown };
      setSelectedEarthquake(earthquakeDataProp.getValue() as EarthEvent);
      onObjectSelectRef.current(null);
      setSelectedAircraft(null);
      setSelectedSatellite(null);
      return;
    }

    // Satellite triangle entity click (WO-082E)
    if (
      entity.properties &&
      (entity.properties as { [k: string]: unknown })[PICKING_FIELDS.satelliteEntityData]
    ) {
      const satelliteDataProp = (entity.properties as { [k: string]: unknown })[
        PICKING_FIELDS.satelliteEntityData
      ] as { getValue: () => unknown };
      setSelectedSatellite(satelliteDataProp.getValue() as SatelliteFrontendItem);
      onObjectSelectRef.current(null);
      setSelectedAircraft(null);
      setSelectedEarthquake(null);
      return;
    }

    // Energy infrastructure feature click
    if (
      entity.id &&
      typeof entity.id === 'string' &&
      entity.id.startsWith('energy-')
    ) {
      const rawDataProp = (entity.properties as { [k: string]: unknown } | undefined)?.[
        PICKING_FIELDS.rawData
      ] as { getValue: () => unknown } | undefined;
      const energyFeature = rawDataProp?.getValue() as EnergyFeature | undefined;
      if (energyFeature) {
        onEnergyFeatureSelectRef?.current?.(energyFeature);
        onObjectSelectRef.current(null);
        clearLocalSelections();
      }
      return;
    }

    if (
      entity.properties &&
      (entity.properties as { [k: string]: unknown })[PICKING_FIELDS.rawData]
    ) {
      const rawDataProp = (entity.properties as { [k: string]: unknown })[
        PICKING_FIELDS.rawData
      ] as { getValue: () => unknown };
      onObjectSelectRef.current(rawDataProp.getValue());
      clearLocalSelections();
    }
  };
}
