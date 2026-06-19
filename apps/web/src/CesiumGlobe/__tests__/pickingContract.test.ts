/**
 * pickingContract.test.ts — Wave 4 CesiumGlobe split (W4-B)
 *
 * Pins the 8 hidden picking field names that CesiumGlobe's click
 * handler reads from billboard `id` objects and entity `properties`
 * objects. This test exists BEFORE any picking-logic extraction (W4-F)
 * so that a future refactor cannot silently rename any of these fields.
 *
 * Pure test — no Cesium Viewer, no Cesium Scene, no
 * ScreenSpaceEventHandler, no React render, no DOM/browser setup.
 * The test imports only the contract module and runs in Node + Vitest.
 *
 * The picking contract is the single highest-risk hidden coupling in
 * `apps/web/src/CesiumGlobe.tsx`. The 5 billboard-style fields are
 * produced by layer subcomponents (or by CesiumGlobe itself) and
 * consumed by CesiumGlobe's click handler. The 3 entity-property
 * keys are produced by CesiumGlobe (or EnergyInfrastructureLayer) and
 * consumed by CesiumGlobe's click handler.
 */

import { describe, expect, it } from 'vitest';
import {
  PICKING_FIELDS,
  createAircraftPickingId,
  createEntityPropertyBag,
  createNewsPickingId,
  createSatellitePickingId,
  createVesselPickingId,
  createWeatherPickingId,
} from '../pickingFields';

describe('CesiumGlobe picking contract (Wave 4 W4-B)', () => {
  describe('PICKING_FIELDS constant — exact string pinning', () => {
    it('pins the 5 billboard-style field names exactly', () => {
      // These five are read by CesiumGlobe's LEFT_CLICK handler at
      // `pickedObject.id._xxxData` after `scene.pick(click.position)`.
      // Renaming any one of them silently breaks picking for that layer.
      expect(PICKING_FIELDS.aircraftData).toBe('_aircraftData');
      expect(PICKING_FIELDS.vesselData).toBe('_vesselData');
      expect(PICKING_FIELDS.weatherData).toBe('_weatherData');
      expect(PICKING_FIELDS.newsData).toBe('_newsData');
      expect(PICKING_FIELDS.satelliteData).toBe('_satelliteData');
    });

    it('pins the 3 entity-property keys exactly', () => {
      // These three are read by CesiumGlobe's LEFT_CLICK handler at
      // `entity.properties.<key>.getValue()` for entities produced by
      // the earthquake effect, the satellite effect, and
      // EnergyInfrastructureLayer respectively.
      expect(PICKING_FIELDS.earthquakeEntityData).toBe('earthquakeData');
      expect(PICKING_FIELDS.satelliteEntityData).toBe('satelliteData');
      expect(PICKING_FIELDS.rawData).toBe('rawData');
    });

    it('contains exactly 8 keys (5 billboard + 3 entity)', () => {
      // A future refactor must not silently add or remove picking
      // fields. If you need a new field, add a test case here first
      // and update the producer/consumer audit.
      expect(Object.keys(PICKING_FIELDS)).toHaveLength(8);
    });
  });

  describe('billboard picking-id helpers — exact key + reference preservation', () => {
    const mockAircraft = { sourceObjectId: 'ac-1', callsign: 'TEST1' };
    const mockVessel = { mmsi: 123456789, name: 'TEST-VESSEL' };
    const mockWeather = { observationId: 'wx-1', temperatureC: 12.3 };
    const mockNews = { itemId: 'news-1', headline: 'Test headline' };
    const mockSatellite = { satelliteId: 'sat-1', name: 'TEST-SAT' };

    it('createAircraftPickingId writes exactly `_aircraftData`', () => {
      const id = createAircraftPickingId(mockAircraft);
      expect(Object.keys(id)).toEqual(['_aircraftData']);
      expect(id._aircraftData).toBe(mockAircraft);
      // Reference identity is preserved (no clone, no wrap).
      expect(id._aircraftData).toEqual(mockAircraft);
    });

    it('createVesselPickingId writes exactly `_vesselData`', () => {
      const id = createVesselPickingId(mockVessel);
      expect(Object.keys(id)).toEqual(['_vesselData']);
      expect(id._vesselData).toBe(mockVessel);
      expect(id._vesselData).toEqual(mockVessel);
    });

    it('createWeatherPickingId writes exactly `_weatherData`', () => {
      const id = createWeatherPickingId(mockWeather);
      expect(Object.keys(id)).toEqual(['_weatherData']);
      expect(id._weatherData).toBe(mockWeather);
      expect(id._weatherData).toEqual(mockWeather);
    });

    it('createNewsPickingId writes exactly `_newsData`', () => {
      const id = createNewsPickingId(mockNews);
      expect(Object.keys(id)).toEqual(['_newsData']);
      expect(id._newsData).toBe(mockNews);
      expect(id._newsData).toEqual(mockNews);
    });

    it('createSatellitePickingId writes exactly `_satelliteData`', () => {
      const id = createSatellitePickingId(mockSatellite);
      expect(Object.keys(id)).toEqual(['_satelliteData']);
      expect(id._satelliteData).toBe(mockSatellite);
      expect(id._satelliteData).toEqual(mockSatellite);
    });

    it('all 5 helpers produce objects with no extra keys', () => {
      // A future refactor that accidentally adds a `_id`, `_kind`, or
      // similar auxiliary field would still satisfy the equality check
      // but would change the wire format. Lock the key count to 1.
      expect(Object.keys(createAircraftPickingId(mockAircraft))).toHaveLength(1);
      expect(Object.keys(createVesselPickingId(mockVessel))).toHaveLength(1);
      expect(Object.keys(createWeatherPickingId(mockWeather))).toHaveLength(1);
      expect(Object.keys(createNewsPickingId(mockNews))).toHaveLength(1);
      expect(Object.keys(createSatellitePickingId(mockSatellite))).toHaveLength(1);
    });

    it('helpers do not mutate the input data object', () => {
      const frozen = Object.freeze({ ...mockAircraft });
      const id = createAircraftPickingId(frozen);
      expect(() => {
        // Reading is fine; the helper does not write to the input.
        return id._aircraftData.sourceObjectId;
      }).not.toThrow();
      expect(id._aircraftData).toBe(frozen);
    });

    it('helpers do not export a renamed `aircraftData`, `vesselData`, etc.', () => {
      // Pin against the most likely accidental rename (camelCase
      // without the underscore prefix). If a future refactor ships a
      // `_xxxData` -> `xxxData` rename, these assertions catch it.
      const ac = createAircraftPickingId(mockAircraft) as Record<string, unknown>;
      const ve = createVesselPickingId(mockVessel) as Record<string, unknown>;
      const wx = createWeatherPickingId(mockWeather) as Record<string, unknown>;
      const ne = createNewsPickingId(mockNews) as Record<string, unknown>;
      const sa = createSatellitePickingId(mockSatellite) as Record<string, unknown>;
      expect(ac.aircraftData).toBeUndefined();
      expect(ve.vesselData).toBeUndefined();
      expect(wx.weatherData).toBeUndefined();
      expect(ne.newsData).toBeUndefined();
      expect(sa.satelliteData).toBeUndefined();
    });
  });

  describe('entity property bag helper — exact key + reference preservation', () => {
    const mockEarthquake = { id: 'eq-1', magnitude: 4.5 };
    const mockSatEntity = { satelliteId: 'sat-ent-1', name: 'TEST-ENT' };
    const mockEnergyFeature = { id: 'energy-1', name: 'Test Plant' };

    it('earthquakeData bag writes exactly `earthquakeData`', () => {
      const bag = createEntityPropertyBag('earthquakeData', {
        value: mockEarthquake,
      });
      expect(Object.keys(bag)).toEqual(['earthquakeData']);
      expect(bag.earthquakeData).toEqual({ value: mockEarthquake });
    });

    it('satelliteData bag writes exactly `satelliteData`', () => {
      const bag = createEntityPropertyBag('satelliteData', {
        value: mockSatEntity,
      });
      expect(Object.keys(bag)).toEqual(['satelliteData']);
      expect(bag.satelliteData).toEqual({ value: mockSatEntity });
    });

    it('rawData bag writes exactly `rawData`', () => {
      const bag = createEntityPropertyBag('rawData', {
        value: mockEnergyFeature,
      });
      expect(Object.keys(bag)).toEqual(['rawData']);
      expect(bag.rawData).toEqual({ value: mockEnergyFeature });
    });

    it('entity bags do not have renamed keys', () => {
      // Pin against the most likely accidental rename (camelCase,
      // singular `earthquake` / `satellite` / `raw`).
      const eq = createEntityPropertyBag('earthquakeData', 1) as Record<string, unknown>;
      const sa = createEntityPropertyBag('satelliteData', 1) as Record<string, unknown>;
      const ra = createEntityPropertyBag('rawData', 1) as Record<string, unknown>;
      expect(eq.earthquake).toBeUndefined();
      expect(sa.satellite).toBeUndefined();
      expect(ra.raw).toBeUndefined();
    });
  });

  describe('producer / consumer cross-reference (documentation)', () => {
    // These expectations are documentation-only — they assert the
    // contract holds against the *named* constants rather than
    // re-grepping source files. The hard rule is: the constants in
    // PICKING_FIELDS must match the magic literals in the producers
    // and consumers. A producer / consumer grep is run as part of the
    // W4-F review gate; this section pins the abstract invariant.
    it('5 billboard field names match the producer keys', () => {
      expect(PICKING_FIELDS.aircraftData).toMatch(/^_/);
      expect(PICKING_FIELDS.vesselData).toMatch(/^_/);
      expect(PICKING_FIELDS.weatherData).toMatch(/^_/);
      expect(PICKING_FIELDS.newsData).toMatch(/^_/);
      expect(PICKING_FIELDS.satelliteData).toMatch(/^_/);
    });

    it('3 entity property keys do NOT start with underscore', () => {
      // Entity property keys live on Cesium `Entity.properties`, which
      // is a plain JS object — no `_xxx` prefix convention. This is
      // intentional and must not be changed.
      expect(PICKING_FIELDS.earthquakeEntityData.startsWith('_')).toBe(false);
      expect(PICKING_FIELDS.satelliteEntityData.startsWith('_')).toBe(false);
      expect(PICKING_FIELDS.rawData.startsWith('_')).toBe(false);
    });
  });
});
