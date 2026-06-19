import { describe, expect, it, beforeEach } from 'vitest';
import type { AirportObject } from '@god-eyes/contracts';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import {
  API_CATEGORY_BALLOONPORT,
  API_CATEGORY_CLOSED,
  API_CATEGORY_HELIPORT,
  API_CATEGORY_LARGE,
  API_CATEGORY_REGIONAL,
  API_CATEGORY_SMALL,
  API_CATEGORY_UNKNOWN,
  API_CATEGORY_WATER,
  AVIATION_CATEGORIES,
  BBOX_ROUNDING,
  DEFAULT_AVIATION_FILTERS,
  DISPLAY_TO_BACKEND_MAP,
  LOD_TIER_THRESHOLDS,
  OPERATIONAL_CATEGORIES,
  ZOOM_TIER_LABELS,
  getAviationDisplayCategory,
  getBackendCategoriesToFetch,
  getBboxRoundingForTier,
  getCategoryInfo,
  getCategoryLabel,
  getZoomTierFromHeight,
  isSmartLODMode,
} from '../airports/aviationCategories';
import {
  bboxToTileIds,
  clearTileCache,
  clearInFlightTiles,
  generateAllTileIds,
  getTile,
  getTileCacheStats,
  hasTile,
  isStale,
  isTileInFlight,
  makeTileKey,
  markTileDone,
  markTileInFlight,
  setTile,
  TILE_DEGREES,
  tileIdToBbox,
} from '../airports/aviationTileCache';
import {
  clearObjectStore,
  getAllObjects,
  getObject,
  getObjectCount,
  hasObject,
  storeObject,
  storeObjects,
} from '../airports/aviationObjectStore';

function mockAirport(overrides: Partial<AirportObject> = {}): AirportObject {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    layerId: 'layer_01_aviation',
    objectType: 'airport',
    sourceId: 'ourairports',
    sourceObjectId: 'KSEA',
    name: 'Seattle-Tacoma Intl',
    ident: 'KSEA',
    iataCode: 'SEA',
    category: 'large_airport',
    typeSource: 'large_airport',
    country: 'US',
    region: 'US-WA',
    municipality: 'Seattle',
    position: { latitude: 47.4502, longitude: -122.3088 },
    elevationFt: 433,
    ...overrides,
  };
}

describe('Aviation Layer (Layer 01) Tests', () => {
  beforeEach(() => {
    clearTileCache();
    clearInFlightTiles();
    clearObjectStore();
  });

  describe('Layer Registration', () => {
    it('registers layer_01_aviation as active, implemented, default ON', () => {
      const layer = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_01_aviation');
      expect(layer).toBeDefined();
      expect(layer?.status).toBe('active');
      expect(layer?.isImplemented).toBe(true);
      expect(layer?.isEnabled).toBe(true);
      expect(layer?.category).toBe('Transportation');
      expect(layer?.dataStatus).toBe('live');
      expect(layer?.sourceRule).toContain('OurAirports');
    });
  });

  describe('aviationCategories — category map & display mapping', () => {
    it('exposes all 8 display categories (7 operational + closed)', () => {
      const expected = ['major', 'regional', 'local', 'heliport', 'seaplane', 'balloonport', 'unknown', 'closed'];
      for (const cat of expected) {
        expect(AVIATION_CATEGORIES[cat as keyof typeof AVIATION_CATEGORIES]).toBeDefined();
        expect(AVIATION_CATEGORIES[cat as keyof typeof AVIATION_CATEGORIES].label).toBeTruthy();
      }
    });

    it('marks closed category as not default-visible', () => {
      expect(AVIATION_CATEGORIES.closed.defaultVisible).toBe(false);
    });

    it('marks all operational categories as default-visible', () => {
      for (const cat of OPERATIONAL_CATEGORIES) {
        expect(AVIATION_CATEGORIES[cat].defaultVisible).toBe(true);
      }
    });

    it('maps ourairports large_airport to major', () => {
      expect(getAviationDisplayCategory({ category: 'large_airport', typeSource: 'large_airport' })).toBe('major');
    });

    it('maps ourairports medium_airport to regional', () => {
      expect(getAviationDisplayCategory({ category: 'medium_airport', typeSource: 'medium_airport' })).toBe('regional');
    });

    it('maps ourairports small_airport to local', () => {
      expect(getAviationDisplayCategory({ category: 'small_airport', typeSource: 'small_airport' })).toBe('local');
    });

    it('maps heliport category and source', () => {
      expect(getAviationDisplayCategory({ category: 'heliport', typeSource: 'heliport' })).toBe('heliport');
      expect(getAviationDisplayCategory({ category: '', typeSource: 'heliport' })).toBe('heliport');
    });

    it('maps water landing and seaplane source', () => {
      expect(getAviationDisplayCategory({ category: API_CATEGORY_WATER, typeSource: '' })).toBe('seaplane');
      expect(getAviationDisplayCategory({ category: '', typeSource: 'seaplane_base' })).toBe('seaplane');
      expect(getAviationDisplayCategory({ category: '', typeSource: 'floatplane' })).toBe('seaplane');
    });

    it('maps balloonport category', () => {
      expect(getAviationDisplayCategory({ category: API_CATEGORY_BALLOONPORT, typeSource: '' })).toBe('balloonport');
    });

    it('maps closed by category, by API slug, and by typeSource', () => {
      expect(getAviationDisplayCategory({ category: 'closed', typeSource: '' })).toBe('closed');
      expect(getAviationDisplayCategory({ category: API_CATEGORY_CLOSED, typeSource: '' })).toBe('closed');
      expect(getAviationDisplayCategory({ category: '', typeSource: 'abandoned' })).toBe('closed');
    });

    it('returns unknown for empty / unrecognized airports', () => {
      expect(getAviationDisplayCategory({ category: '', typeSource: '' })).toBe('unknown');
      expect(getAviationDisplayCategory({ category: 'something_weird', typeSource: 'whatever' })).toBe('unknown');
    });

    it('returns the short label and full info correctly', () => {
      const info = getCategoryInfo({ category: 'large_airport', typeSource: 'large_airport' });
      expect(info.id).toBe('major');
      expect(info.shortLabel).toBe('Major');
      expect(info.label).toContain('Major');
      expect(getCategoryLabel({ category: 'large_airport', typeSource: 'large_airport' })).toBe('Major');
    });
  });

  describe('aviationCategories — backend category mapping', () => {
    it('exposes the canonical 8 backend category slugs', () => {
      expect(API_CATEGORY_LARGE).toBe('international_or_major_airport');
      expect(API_CATEGORY_REGIONAL).toBe('regional_or_domestic_airport');
      expect(API_CATEGORY_SMALL).toBe('small_airfield');
      expect(API_CATEGORY_HELIPORT).toBe('heliport');
      expect(API_CATEGORY_WATER).toBe('water_landing_site');
      expect(API_CATEGORY_BALLOONPORT).toBe('balloonport');
      expect(API_CATEGORY_CLOSED).toBe('closed_or_abandoned');
      expect(API_CATEGORY_UNKNOWN).toBe('unknown');
    });

    it('exposes a complete DISPLAY_TO_BACKEND_MAP', () => {
      const keys = Object.keys(DISPLAY_TO_BACKEND_MAP).sort();
      expect(keys).toEqual(
        ['balloonport', 'closed', 'heliport', 'local', 'major', 'regional', 'seaplane', 'unknown'].sort()
      );
    });
  });

  describe('aviationCategories — Smart LOD mode and tier expansion', () => {
    it('isSmartLODMode is true only when all 7 operational categories are ON', () => {
      expect(isSmartLODMode(DEFAULT_AVIATION_FILTERS)).toBe(false); // only major is ON by default
      const allOn = {
        major: true,
        regional: true,
        local: true,
        heliport: true,
        seaplane: true,
        balloonport: true,
        unknown: true,
        closed: false,
      };
      expect(isSmartLODMode(allOn)).toBe(true);
    });

    it('smart LOD tier 0 fetches only the major category', () => {
      const allOn = {
        major: true, regional: true, local: true, heliport: true,
        seaplane: true, balloonport: true, unknown: true, closed: false,
      };
      expect(getBackendCategoriesToFetch(0, allOn)).toEqual([API_CATEGORY_LARGE]);
    });

    it('smart LOD tier 1 fetches major + regional', () => {
      const allOn = {
        major: true, regional: true, local: true, heliport: true,
        seaplane: true, balloonport: true, unknown: true, closed: false,
      };
      expect(getBackendCategoriesToFetch(1, allOn)).toEqual([API_CATEGORY_LARGE, API_CATEGORY_REGIONAL]);
    });

    it('smart LOD tier 2 adds small + heliport + water + balloonport', () => {
      const allOn = {
        major: true, regional: true, local: true, heliport: true,
        seaplane: true, balloonport: true, unknown: true, closed: false,
      };
      const out = getBackendCategoriesToFetch(2, allOn);
      expect(out).toContain(API_CATEGORY_LARGE);
      expect(out).toContain(API_CATEGORY_REGIONAL);
      expect(out).toContain(API_CATEGORY_SMALL);
      expect(out).toContain(API_CATEGORY_HELIPORT);
      expect(out).toContain(API_CATEGORY_WATER);
      expect(out).toContain(API_CATEGORY_BALLOONPORT);
      expect(out).not.toContain(API_CATEGORY_UNKNOWN);
    });

    it('smart LOD tier 3 includes unknown and (optionally) closed', () => {
      const allOn = {
        major: true, regional: true, local: true, heliport: true,
        seaplane: true, balloonport: true, unknown: true, closed: true,
      };
      const out = getBackendCategoriesToFetch(3, allOn);
      expect(out).toContain(API_CATEGORY_UNKNOWN);
      expect(out).toContain(API_CATEGORY_CLOSED);
    });

    it('smart LOD tier 3 omits closed when closed filter is OFF', () => {
      const allOn = {
        major: true, regional: true, local: true, heliport: true,
        seaplane: true, balloonport: true, unknown: true, closed: false,
      };
      const out = getBackendCategoriesToFetch(3, allOn);
      expect(out).toContain(API_CATEGORY_UNKNOWN);
      expect(out).not.toContain(API_CATEGORY_CLOSED);
    });

    it('explicit (non-smart) mode returns only enabled display categories', () => {
      const explicit = {
        major: true,
        regional: false,
        local: false,
        heliport: true,
        seaplane: false,
        balloonport: false,
        unknown: false,
        closed: false,
      };
      expect(getBackendCategoriesToFetch(3, explicit)).toEqual([
        API_CATEGORY_LARGE,
        API_CATEGORY_HELIPORT,
      ]);
    });

    it('defaults unknown tier to tier 0 (major only)', () => {
      const allOn = {
        major: true, regional: true, local: true, heliport: true,
        seaplane: true, balloonport: true, unknown: true, closed: false,
      };
      expect(getBackendCategoriesToFetch(99, allOn)).toEqual([API_CATEGORY_LARGE]);
    });
  });

  describe('aviationCategories — zoom tier & bbox rounding', () => {
    it('returns 0 when very high and 3 when very low', () => {
      expect(getZoomTierFromHeight(LOD_TIER_THRESHOLDS.UP_1_TO_0, 0)).toBe(0);
      expect(getZoomTierFromHeight(0, 3)).toBe(3);
    });

    it('hysteresis: stays in tier 0 until DOWN_0_TO_1 is crossed (strict <)', () => {
      // At the exact DOWN_0_TO_1 boundary the implementation still returns 0
      // (it uses a strict `<` comparison).
      expect(getZoomTierFromHeight(LOD_TIER_THRESHOLDS.UP_1_TO_0, 0)).toBe(0);
      expect(getZoomTierFromHeight(LOD_TIER_THRESHOLDS.DOWN_0_TO_1, 0)).toBe(0);
      // One metre below the boundary flips to tier 1.
      expect(getZoomTierFromHeight(LOD_TIER_THRESHOLDS.DOWN_0_TO_1 - 1, 0)).toBe(1);
    });

    it('hysteresis: stays in tier 3 until UP_3_TO_2 is crossed', () => {
      expect(getZoomTierFromHeight(LOD_TIER_THRESHOLDS.UP_3_TO_2 - 1, 3)).toBe(3);
      expect(getZoomTierFromHeight(LOD_TIER_THRESHOLDS.UP_3_TO_2, 3)).toBe(2);
    });

    it('ZOOM_TIER_LABELS exposes a label for every defined tier', () => {
      expect(ZOOM_TIER_LABELS[0]).toBe('GLOBAL');
      expect(ZOOM_TIER_LABELS[1]).toBe('REGIONAL');
      expect(ZOOM_TIER_LABELS[2]).toBe('STATE');
      expect(ZOOM_TIER_LABELS[3]).toBe('LOCAL');
    });

    it('getBboxRoundingForTier returns documented values with a safe default', () => {
      expect(getBboxRoundingForTier(0)).toBe(BBOX_ROUNDING[0]);
      expect(getBboxRoundingForTier(1)).toBe(BBOX_ROUNDING[1]);
      expect(getBboxRoundingForTier(2)).toBe(BBOX_ROUNDING[2]);
      expect(getBboxRoundingForTier(3)).toBe(BBOX_ROUNDING[3]);
      // unknown tier -> safe default
      expect(getBboxRoundingForTier(99)).toBe(0.1);
    });
  });

  describe('aviationTileCache — pure helpers', () => {
    it('TILE_DEGREES is documented as 30 degrees', () => {
      expect(TILE_DEGREES).toBe(30);
    });

    it('makeTileKey encodes all 4 components in a stable order', () => {
      const k1 = makeTileKey('large_airport', '-120_30', 'points', true);
      const k2 = makeTileKey('large_airport', '-120_30', 'points', false);
      expect(k1).toBe('large_airport:-120_30:points:c');
      expect(k2).toBe('large_airport:-120_30:points:nc');
      expect(k1).not.toBe(k2);
    });

    it('bboxToTileIds enumerates a single tile for a small bbox', () => {
      const tiles = bboxToTileIds('10,20,12,22', 30);
      expect(tiles).toEqual(['0_0']);
    });

    it('bboxToTileIds enumerates multiple tiles for a global bbox', () => {
      const tiles = bboxToTileIds('-180,-90,180,90', 30);
      // 12 latitude buckets (90/-90 = 6 ranges of 30 deg) * 12 longitude buckets (180/-180 = 6 ranges of 30 deg)
      // Actually 360/30 = 12, 180/30 = 6, total = 72.
      expect(tiles).toHaveLength(72);
      expect(tiles[0]).toBe('-180_-90');
    });

    it('bboxToTileIds returns [] for invalid input', () => {
      expect(bboxToTileIds('foo,bar,baz,qux')).toEqual([]);
      expect(bboxToTileIds('a,b,c,d')).toEqual([]);
    });

    it('generateAllTileIds covers the full world', () => {
      const all = generateAllTileIds(30);
      expect(all).toHaveLength(72);
      expect(all[0]).toBe('-180_-90');
      expect(all[all.length - 1]).toBe('150_60');
    });

    it('tileIdToBbox returns the canonical 4-number bbox string', () => {
      expect(tileIdToBbox('0_0', 30)).toBe('0,0,30,30');
      expect(tileIdToBbox('-150_-60', 30)).toBe('-150,-60,-120,-30');
    });

    it('setTile + getTile round-trips data and increments hit counter', () => {
      const key = makeTileKey('large_airport', '0_0', 'points', true);
      const data = [mockAirport()];
      const before = getTileCacheStats().hits;
      setTile(key, data);
      const entry = getTile(key);
      expect(entry?.data).toBe(data);
      expect(getTile(key)).toBeDefined();
      const after = getTileCacheStats().hits;
      expect(after).toBe(before + 2);
    });

    it('getTile returns undefined and increments miss counter for missing keys', () => {
      const before = getTileCacheStats().misses;
      expect(getTile('not-in-cache')).toBeUndefined();
      expect(getTileCacheStats().misses).toBe(before + 1);
    });

    it('hasTile mirrors getTile for present / missing keys', () => {
      const key = makeTileKey('large_airport', '30_30', 'points', false);
      expect(hasTile(key)).toBe(false);
      setTile(key, []);
      expect(hasTile(key)).toBe(true);
    });

    it('isStale returns true for missing tiles and false for fresh ones', () => {
      expect(isStale('nope')).toBe(true);
      const key = makeTileKey('large_airport', '60_30', 'points', false);
      setTile(key, []);
      expect(isStale(key)).toBe(false);
    });

    it('markTileInFlight / markTileDone track in-flight state', () => {
      const key = makeTileKey('large_airport', '90_30', 'points', false);
      expect(isTileInFlight(key)).toBe(false);
      markTileInFlight(key);
      expect(isTileInFlight(key)).toBe(true);
      markTileDone(key);
      expect(isTileInFlight(key)).toBe(false);
    });

    it('clearTileCache resets hits, misses, and entries', () => {
      setTile('k', []);
      getTile('k');
      clearTileCache();
      const stats = getTileCacheStats();
      expect(stats.entries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('aviationObjectStore — pure CRUD', () => {
    it('storeObject + getObject round-trips a single airport', () => {
      const a = mockAirport();
      storeObject(a);
      expect(hasObject(a.id)).toBe(true);
      expect(getObject(a.id)).toBe(a);
    });

    it('storeObjects inserts every airport by id and counts them', () => {
      const a = mockAirport({ id: '00000000-0000-0000-0000-000000000001' });
      const b = mockAirport({ id: '00000000-0000-0000-0000-000000000002', ident: 'KLAX' });
      storeObjects([a, b]);
      expect(getObjectCount()).toBe(2);
      expect(getAllObjects().map((o) => o.ident).sort()).toEqual(['KLAX', 'KSEA']);
    });

    it('overwrites an existing id when stored again', () => {
      const a1 = mockAirport({ name: 'Old name' });
      const a2 = mockAirport({ name: 'New name' });
      storeObject(a1);
      storeObject(a2);
      expect(getObjectCount()).toBe(1);
      expect(getObject(a1.id)?.name).toBe('New name');
    });

    it('getObject returns undefined for unknown ids', () => {
      expect(getObject('00000000-0000-0000-0000-deadbeefcafe')).toBeUndefined();
      expect(hasObject('00000000-0000-0000-0000-deadbeefcafe')).toBe(false);
    });

    it('clearObjectStore wipes everything', () => {
      storeObjects([mockAirport(), mockAirport({ id: '00000000-0000-0000-0000-000000000002' })]);
      expect(getObjectCount()).toBe(2);
      clearObjectStore();
      expect(getObjectCount()).toBe(0);
      expect(getAllObjects()).toEqual([]);
    });
  });
});
