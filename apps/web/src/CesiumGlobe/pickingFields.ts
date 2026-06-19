/**
 * pickingFields.ts — Wave 4 CesiumGlobe split (W4-B)
 *
 * Pure contract module that pins the hidden picking-id field names
 * used between CesiumGlobe's click handler (consumer) and the per-layer
 * billboard/entity producers (MaritimeLayer, WeatherLayer, NewsLayer,
 * EnergyInfrastructureLayer, and CesiumGlobe's own earthquake/satellite/
 * aircraft/satellite-dot effects).
 *
 * This module is intentionally:
 *   - free of Cesium imports (no Viewer, no Entity, no ConstantProperty,
 *     no ScreenSpaceEventHandler)
 *   - free of React imports (no JSX, no hooks)
 *   - free of browser globals (no `window`, no `document`)
 *
 * It exists so that the picking contract can be tested without standing
 * up a Cesium scene, and so that the eventual W4-F extraction of
 * `usePickingHandler` can import these exact string constants instead of
 * relying on magic literals scattered through `apps/web/src/CesiumGlobe.tsx`.
 *
 * NO PRODUCTION CODE imports this module yet. W4-B lands the contract
 * first; W4-F will connect the picking handler to these constants.
 */

/**
 * The exact field-name strings used by CesiumGlobe's click handler
 * and the per-layer billboard/entity producers. **Do not rename.**
 *
 * Five are billboard-style (`billboard.id._xxxData`) and three are
 * entity-style (`entity.properties.yyyData`). The two shapes are
 * consumed differently inside the click handler:
 *
 *   billboard:  pickedObject.id._xxxData  (direct read)
 *   entity:     entity.properties.yyyData.getValue()  (wrapped value)
 */
export const PICKING_FIELDS = {
  /** CesiumGlobe writes `billboard.id._aircraftData` (AircraftLatest). */
  aircraftData: '_aircraftData',
  /** MaritimeLayer writes `billboard.id._vesselData` (MaritimeVesselObject). */
  vesselData: '_vesselData',
  /** WeatherLayer writes `billboard.id._weatherData` (WeatherRenderItem). */
  weatherData: '_weatherData',
  /** NewsLayer writes `billboard.id._newsData` (NewsRenderMarker). */
  newsData: '_newsData',
  /** CesiumGlobe writes `point.id._satelliteData` for satellite dots. */
  satelliteData: '_satelliteData',
  /** CesiumGlobe writes `entity.properties.earthquakeData` (EarthEvent). */
  earthquakeEntityData: 'earthquakeData',
  /** CesiumGlobe writes `entity.properties.satelliteData` for satellite entities. */
  satelliteEntityData: 'satelliteData',
  /** EnergyInfrastructureLayer writes `entity.properties.rawData` (EnergyFeature). */
  rawData: 'rawData',
} as const;

/**
 * Type for the 5 billboard-style field names. The 3 entity property
 * keys are typed separately below because they live under
 * `entity.properties.<key>` rather than `billboard.id.<key>`.
 */
export type BillboardPickingField =
  | typeof PICKING_FIELDS.aircraftData
  | typeof PICKING_FIELDS.vesselData
  | typeof PICKING_FIELDS.weatherData
  | typeof PICKING_FIELDS.newsData
  | typeof PICKING_FIELDS.satelliteData;

/**
 * Type for the 3 entity property keys. Producers wrap values in
 * Cesium `ConstantProperty`; consumers call `.getValue()` to unwrap.
 * This module does not depend on Cesium types — the type parameter on
 * `createEntityPropertyBag` is generic.
 */
export type EntityPropertyKey =
  | typeof PICKING_FIELDS.earthquakeEntityData
  | typeof PICKING_FIELDS.satelliteEntityData
  | typeof PICKING_FIELDS.rawData;

/**
 * Generic low-level billboard picking-id factory. All 5 billboard
 * helpers below are one-line wrappers around this function.
 *
 * The returned object has exactly one own key whose name is the field
 * constant from `PICKING_FIELDS`. The helper does NOT mutate `data`,
 * does NOT clone it, and does NOT add extra keys.
 */
export function createBillboardPickingId<T>(
  field: BillboardPickingField,
  data: T,
): { [K in BillboardPickingField]: T } & { [key: string]: unknown } {
  return { [field]: data } as { [K in BillboardPickingField]: T } & {
    [key: string]: unknown;
  };
}

export function createAircraftPickingId<T>(data: T) {
  return createBillboardPickingId<T>(PICKING_FIELDS.aircraftData, data);
}

export function createVesselPickingId<T>(data: T) {
  return createBillboardPickingId<T>(PICKING_FIELDS.vesselData, data);
}

export function createWeatherPickingId<T>(data: T) {
  return createBillboardPickingId<T>(PICKING_FIELDS.weatherData, data);
}

export function createNewsPickingId<T>(data: T) {
  return createBillboardPickingId<T>(PICKING_FIELDS.newsData, data);
}

export function createSatellitePickingId<T>(data: T) {
  return createBillboardPickingId<T>(PICKING_FIELDS.satelliteData, data);
}

/**
 * Generic low-level entity property bag factory. Producers use this
 * to write `entity.properties = createEntityPropertyBag(KEY, value)`.
 * Consumers read via `entity.properties[KEY].getValue()`.
 *
 * In production the value is a Cesium `ConstantProperty`; this module
 * does not import Cesium, so the type parameter is generic and the
 * helper does not enforce the `.getValue()` shape. Tests assert the
 * key name and the original object reference identity instead.
 */
export function createEntityPropertyBag<K extends EntityPropertyKey, V>(
  key: K,
  value: V,
): { [P in K]: V } {
  return { [key]: value } as { [P in K]: V };
}
