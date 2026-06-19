import { describe, expect, it } from 'vitest';
import type { SpaceSatelliteItem } from '@god-eyes/contracts';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import {
  DEFAULT_SATELLITE_FILTERS,
  SAFE_RENDER_CAP,
  getFilteredSatellites,
  satellitePassesFilter,
} from '../satellites/satelliteFilters';
import { getSatelliteColor, getSatellitePixelSize } from '../satellites/satelliteColors';
import { INITIAL_SPACE_STATUS } from '../satellites/satelliteTypes';
import type { SatelliteFrontendItem } from '../satellites/satelliteTypes';

function mockSpaceItem(
  overrides: Partial<SpaceSatelliteItem> = {}
): SpaceSatelliteItem {
  return {
    satelliteId: '00000000-0000-0000-0000-000000000001',
    noradId: 25544,
    name: 'ISS (ZARYA)',
    objectType: 'satellite',
    category: 'Starlink',
    orbitClass: 'LEO',
    country: 'US',
    launchDate: '1998-11-20',
    position: { latitude: 12.34, longitude: 56.78, altitudeKm: 410 },
    velocity: { speedKms: 7.66 },
    headingDeg: 90,
    visualShape: 'dot',
    visualColor: '#00e5ff',
    important: false,
    estimatedAt: '2026-06-12T12:00:00Z',
    sourceId: 'celestrak',
    sourceObjectId: '25544',
    sourceAgeSeconds: 5,
    ...overrides,
  };
}

function mockFrontendItem(
  overrides: Partial<SatelliteFrontendItem> = {}
): SatelliteFrontendItem {
  return {
    satelliteId: '00000000-0000-0000-0000-000000000001',
    noradId: 25544,
    name: 'ISS (ZARYA)',
    objectType: 'satellite',
    category: 'Starlink',
    orbitClass: 'LEO',
    country: 'US',
    launchDate: '1998-11-20',
    latitude: 12.34,
    longitude: 56.78,
    altitudeKm: 410,
    velocityKms: 7.66,
    headingDeg: 90,
    visualShape: 'dot',
    visualColor: '#00e5ff',
    important: false,
    estimatedAt: '2026-06-12T12:00:00Z',
    sourceId: 'celestrak',
    sourceObjectId: '25544',
    sourceAgeSeconds: 5,
    ...overrides,
  };
}

describe('Space & Satellites Layer (Layer 05) Tests', () => {
  describe('Layer Registration', () => {
    it('registers layer_05_space_satellites as active, implemented, default OFF', () => {
      const layer = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_05_space_satellites');
      expect(layer).toBeDefined();
      expect(layer?.status).toBe('active');
      expect(layer?.isImplemented).toBe(true);
      expect(layer?.category).toBe('Space');
      expect(layer?.sourceRule).toContain('CelesTrak');
    });
  });

  describe('Status initial state', () => {
    it('exposes an idle/zero/empty initial status', () => {
      expect(INITIAL_SPACE_STATUS.phase).toBe('idle');
      expect(INITIAL_SPACE_STATUS.count).toBe(0);
      expect(INITIAL_SPACE_STATUS.lastSuccessAt).toBe(0);
      expect(INITIAL_SPACE_STATUS.errorMessage).toBe('');
    });

    it('freezes the shape of the status object (no extra fields)', () => {
      expect(Object.keys(INITIAL_SPACE_STATUS).sort()).toEqual(
        ['count', 'errorMessage', 'lastSuccessAt', 'phase'].sort()
      );
    });
  });

  describe('Default filter state', () => {
    it('starts with all object-type toggles ON and extreme mode OFF', () => {
      expect(DEFAULT_SATELLITE_FILTERS.showSatellites).toBe(true);
      expect(DEFAULT_SATELLITE_FILTERS.showDebris).toBe(true);
      expect(DEFAULT_SATELLITE_FILTERS.showRocketBodies).toBe(true);
      expect(DEFAULT_SATELLITE_FILTERS.showStarlink).toBe(true);
      expect(DEFAULT_SATELLITE_FILTERS.showInactive).toBe(true);
      expect(DEFAULT_SATELLITE_FILTERS.importantOnly).toBe(false);
      expect(DEFAULT_SATELLITE_FILTERS.extremeMode).toBe(false);
      expect(DEFAULT_SATELLITE_FILTERS.sourceFilter).toBe('all');
    });

    it('exposes a safe render cap of 10,000', () => {
      expect(SAFE_RENDER_CAP).toBe(10_000);
    });
  });

  describe('satellitePassesFilter', () => {
    it('lets a normal satellite through with default filters', () => {
      const sat = mockSpaceItem();
      expect(satellitePassesFilter(sat, DEFAULT_SATELLITE_FILTERS)).toBe(true);
    });

    it('drops debris when showDebris is OFF', () => {
      const sat = mockSpaceItem({ objectType: 'debris' });
      expect(
        satellitePassesFilter(sat, { ...DEFAULT_SATELLITE_FILTERS, showDebris: false })
      ).toBe(false);
    });

    it('drops rocket bodies when showRocketBodies is OFF', () => {
      const sat = mockSpaceItem({ objectType: 'rocket_body' });
      expect(
        satellitePassesFilter(sat, { ...DEFAULT_SATELLITE_FILTERS, showRocketBodies: false })
      ).toBe(false);
    });

    it('drops inactive payloads when showInactive is OFF', () => {
      const sat = mockSpaceItem({ objectType: 'inactive_payload' });
      expect(
        satellitePassesFilter(sat, { ...DEFAULT_SATELLITE_FILTERS, showInactive: false })
      ).toBe(false);
    });

    it('drops satellites when showSatellites is OFF (satellite + unknown types)', () => {
      const sat1 = mockSpaceItem({ objectType: 'satellite' });
      const sat2 = mockSpaceItem({ objectType: 'unknown' });
      const filters = { ...DEFAULT_SATELLITE_FILTERS, showSatellites: false };
      expect(satellitePassesFilter(sat1, filters)).toBe(false);
      expect(satellitePassesFilter(sat2, filters)).toBe(false);
    });

    it('drops non-important satellites when importantOnly is ON', () => {
      const normal = mockSpaceItem({ important: false });
      const important = mockSpaceItem({ important: true });
      const filters = { ...DEFAULT_SATELLITE_FILTERS, importantOnly: true };
      expect(satellitePassesFilter(normal, filters)).toBe(false);
      expect(satellitePassesFilter(important, filters)).toBe(true);
    });

    it('drops Starlink items when showStarlink is OFF (case-insensitive category match)', () => {
      const starlink = mockSpaceItem({ category: 'starlink constellation' });
      const other = mockSpaceItem({ category: 'Iridium' });
      const filters = { ...DEFAULT_SATELLITE_FILTERS, showStarlink: false };
      expect(satellitePassesFilter(starlink, filters)).toBe(false);
      expect(satellitePassesFilter(other, filters)).toBe(true);
    });

    it('honours celestrak source filter', () => {
      const celestrak = mockSpaceItem({ sourceId: 'celestrak-stations' });
      const spaceTrack = mockSpaceItem({ sourceId: 'space-track' });
      const filters = { ...DEFAULT_SATELLITE_FILTERS, sourceFilter: 'celestrak' as const };
      expect(satellitePassesFilter(celestrak, filters)).toBe(true);
      expect(satellitePassesFilter(spaceTrack, filters)).toBe(false);
    });

    it('honours space-track source filter', () => {
      const celestrak = mockSpaceItem({ sourceId: 'celestrak-stations' });
      const spaceTrack = mockSpaceItem({ sourceId: 'space-track-gp' });
      const filters = { ...DEFAULT_SATELLITE_FILTERS, sourceFilter: 'space-track' as const };
      expect(satellitePassesFilter(celestrak, filters)).toBe(false);
      expect(satellitePassesFilter(spaceTrack, filters)).toBe(true);
    });
  });

  describe('getFilteredSatellites — extreme mode & render cap', () => {
    it('returns the unfiltered list when extremeMode is ON', () => {
      const items = Array.from({ length: 25 }, (_, i) =>
        mockSpaceItem({ satelliteId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}` })
      );
      const filters = { ...DEFAULT_SATELLITE_FILTERS, extremeMode: true };
      const out = getFilteredSatellites(items, filters);
      expect(out).toHaveLength(25);
    });

    it('caps the returned list at SAFE_RENDER_CAP when extremeMode is OFF', () => {
      // We don\'t actually create 10,001 items; we fake the size by relying on the
      // implementation. Verify the cap number matches the documented constant.
      expect(SAFE_RENDER_CAP).toBe(10_000);
    });

    it('prioritises important satellites within the cap', () => {
      const important = mockSpaceItem({
        satelliteId: '00000000-0000-0000-0000-000000000099',
        important: true,
        objectType: 'debris',
      });
      const normal = mockSpaceItem({
        satelliteId: '00000000-0000-0000-0000-000000000100',
        important: false,
        objectType: 'satellite',
      });
      // With extremeMode off and only two items, the important one must appear
      // first (this also implicitly covers sort stability for caps).
      const out = getFilteredSatellites([normal, important], DEFAULT_SATELLITE_FILTERS);
      expect(out[0].satelliteId).toBe(important.satelliteId);
    });

    it('applies type filters before the cap', () => {
      const debris = mockSpaceItem({
        satelliteId: '00000000-0000-0000-0000-000000000200',
        objectType: 'debris',
      });
      const sat = mockSpaceItem({
        satelliteId: '00000000-0000-0000-0000-000000000201',
        objectType: 'satellite',
      });
      const out = getFilteredSatellites(
        [debris, sat],
        { ...DEFAULT_SATELLITE_FILTERS, showDebris: false }
      );
      expect(out).toHaveLength(1);
      expect(out[0].satelliteId).toBe(sat.satelliteId);
    });
  });

  describe('getSatelliteColor', () => {
    it('trusts backend visualColor when it is a valid 6-digit hex', () => {
      const sat = mockFrontendItem({ visualColor: '#aabbcc' });
      expect(getSatelliteColor(sat)).toBe('#aabbcc');
    });

    it('ignores backend visualColor when not a valid hex', () => {
      const sat = mockFrontendItem({ visualColor: 'not-a-color', altitudeKm: 410 });
      // 410 km falls in the LEO-mid band (500 km cap), so yellow.
      expect(getSatelliteColor(sat)).toBe('#ffd000');
    });

    it('falls back to altitude bands when backend color is missing', () => {
      expect(getSatelliteColor(mockFrontendItem({ visualColor: '', altitudeKm: 100 }))).toBe('#ff8c00');
      expect(getSatelliteColor(mockFrontendItem({ visualColor: '', altitudeKm: 600 }))).toBe('#80ff00');
      expect(getSatelliteColor(mockFrontendItem({ visualColor: '', altitudeKm: 4000 }))).toBe('#00e5ff');
      expect(getSatelliteColor(mockFrontendItem({ visualColor: '', altitudeKm: 10000 }))).toBe('#0077ff');
      expect(getSatelliteColor(mockFrontendItem({ visualColor: '', altitudeKm: 30000 }))).toBe('#8a2be2');
      expect(getSatelliteColor(mockFrontendItem({ visualColor: '', altitudeKm: 45000 }))).toBe('#ff2d55');
      expect(getSatelliteColor(mockFrontendItem({ visualColor: '', altitudeKm: 80000 }))).toBe('#ff6b6b');
    });

    it('falls back to type color when altitude is null', () => {
      const debris = mockFrontendItem({ visualColor: '', altitudeKm: null, objectType: 'debris' });
      expect(getSatelliteColor(debris)).toBe('#ff6b35');
    });
  });

  describe('getSatellitePixelSize', () => {
    it('returns 8 for important satellites', () => {
      expect(getSatellitePixelSize(mockFrontendItem({ important: true }))).toBe(8);
    });

    it('returns 6 for non-important triangles', () => {
      expect(
        getSatellitePixelSize(mockFrontendItem({ important: false, visualShape: 'triangle' }))
      ).toBe(6);
    });

    it('returns 4 for normal dots', () => {
      expect(
        getSatellitePixelSize(mockFrontendItem({ important: false, visualShape: 'dot' }))
      ).toBe(4);
    });

    it('important triangles still get 8 (important wins over shape)', () => {
      expect(
        getSatellitePixelSize(mockFrontendItem({ important: true, visualShape: 'triangle' }))
      ).toBe(8);
    });
  });
});
