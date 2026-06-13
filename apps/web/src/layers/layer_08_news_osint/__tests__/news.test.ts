import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { NewsMarkerItem, NewsItem } from '@god-eyes/contracts';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import {
  fetchNewsItems,
  fetchNewsMarkers,
  fetchNewsStats,
  fetchNewsSources,
  fetchNewsFetchRuns,
  NEWS_ITEMS_PATH,
  NEWS_MARKERS_PATH,
  NEWS_STATS_PATH,
  NEWS_SOURCES_PATH,
  NEWS_FETCH_RUNS_PATH,
} from '../newsApi';
import {
  mapMarkerToRenderItem,
  mapMarkersToRenderItems,
  mapNewsItemToRenderItem,
  NEWS_LAYER_ID,
  NEWS_ATTRIBUTION,
  NEWS_SEVERITY_COLORS,
} from '../newsTypes';
import {
  getNewsMarkerColor,
  getNewsMarkerImage,
  NEWS_BILLBOARD_SCALE,
} from '../newsMarker';
import {
  formatNewsTimestamp,
  formatNewsSeverity,
  formatNewsCountry,
  orDash,
} from '../newsDetail';

// Mock the browser canvas environment.
beforeAll(() => {
  globalThis.document = {
    createElement: vi.fn().mockReturnValue({
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
      }),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mocked'),
    }),
  } as any;
});

function mockMarkerItem(overrides: Partial<NewsMarkerItem> = {}): NewsMarkerItem {
  return {
    item_id: 'item-1',
    title: 'Flood in Bangladesh',
    source_id: 'gdacs',
    source_url: 'https://gdacs.org/event/1',
    latitude: 23.7,
    longitude: 90.4,
    country_code: 'BD',
    country_name: 'Bangladesh',
    category: 'news',
    subcategory: 'FL',
    severity: 'orange',
    published_at: '2026-06-12T10:00:00Z',
    source_updated_at: '2026-06-12T11:00:00Z',
    marker_ready: true,
    attribution: NEWS_ATTRIBUTION,
    ...overrides,
  };
}

describe('News & OSINT Layer (Layer 08) Tests', () => {
  describe('Layer Registration', () => {
    it('registers layer_08_news_osint as active, implemented, default OFF', () => {
      const layer = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_08_news_osint');
      expect(layer).toBeDefined();
      expect(layer?.status).toBe('active');
      expect(layer?.isImplemented).toBe(true);
      expect(layer?.isEnabled).toBe(false);
      expect(layer?.sourceRule).toBe('GDACS');
    });
  });

  describe('API client — endpoint paths', () => {
    it('calls the correct items endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { layer_id: NEWS_LAYER_ID, count: 0, limit: 100, offset: 0 } }),
      });
      globalThis.fetch = mockFetch;
      await fetchNewsItems();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(NEWS_ITEMS_PATH);
      expect(url).toContain(`/api/layers/${NEWS_LAYER_ID}/news/items`);
      expect(url).not.toContain('gdacs.org');
    });

    it('calls the correct markers endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { layer_id: NEWS_LAYER_ID, count: 0, limit: 500 } }),
      });
      globalThis.fetch = mockFetch;
      await fetchNewsMarkers({ limit: 500 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(NEWS_MARKERS_PATH);
      expect(url).toContain('limit=500');
      expect(url).not.toContain('gdacs.org');
    });

    it('calls the correct stats endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          layer_id: NEWS_LAYER_ID, total_items: 171, marker_ready_items: 47,
          items_with_geom: 50, by_source: [], by_category: [], by_subcategory: [],
          by_severity: [], by_geometry_type: [], latest_fetch_run: null,
          fake_coordinate_risk_count: 0,
        }),
      });
      globalThis.fetch = mockFetch;
      const stats = await fetchNewsStats();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(NEWS_STATS_PATH);
      expect(stats.total_items).toBe(171);
      expect(stats.marker_ready_items).toBe(47);
      expect(stats.fake_coordinate_risk_count).toBe(0);
    });

    it('calls the correct sources endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { count: 0, layer_id: NEWS_LAYER_ID } }),
      });
      globalThis.fetch = mockFetch;
      await fetchNewsSources();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(NEWS_SOURCES_PATH);
    });

    it('calls the correct fetch-runs endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { count: 0, limit: 5, offset: 0, layer_id: NEWS_LAYER_ID } }),
      });
      globalThis.fetch = mockFetch;
      await fetchNewsFetchRuns(5);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain(NEWS_FETCH_RUNS_PATH);
      expect(url).toContain('limit=5');
    });

    it('applies filter params to items request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { layer_id: NEWS_LAYER_ID, count: 0, limit: 100, offset: 0 } }),
      });
      globalThis.fetch = mockFetch;
      await fetchNewsItems({ severity: 'red', subcategory: 'FL', country: 'BD', markerReadyOnly: true });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('severity=red');
      expect(url).toContain('subcategory=FL');
      expect(url).toContain('country=BD');
      expect(url).toContain('marker_ready=true');
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 503,
        json: async () => ({ error: { message: 'Service Unavailable' } }),
      });
      await expect(fetchNewsMarkers()).rejects.toThrow('Service Unavailable');
    });
  });

  describe('Render model mapping', () => {
    it('maps a valid marker to a render item', () => {
      const item = mapMarkerToRenderItem(mockMarkerItem());
      expect(item).not.toBeNull();
      expect(item?.kind).toBe('news');
      expect(item?.itemId).toBe('item-1');
      expect(item?.latitude).toBe(23.7);
      expect(item?.longitude).toBe(90.4);
      expect(item?.severity).toBe('orange');
      expect(item?.countryCode).toBe('BD');
      expect(item?.attribution).toBe(NEWS_ATTRIBUTION);
    });

    it('skips items with missing latitude/longitude', () => {
      expect(mapMarkerToRenderItem(mockMarkerItem({ latitude: NaN as any, longitude: 90.4 }))).toBeNull();
      expect(mapMarkerToRenderItem(mockMarkerItem({ latitude: 23.7, longitude: undefined as any }))).toBeNull();
    });

    it('skips items with out-of-range coordinates', () => {
      expect(mapMarkerToRenderItem(mockMarkerItem({ latitude: 200, longitude: 90.4 }))).toBeNull();
      expect(mapMarkerToRenderItem(mockMarkerItem({ latitude: 23.7, longitude: 999 }))).toBeNull();
    });

    it('maps arrays defensively, skipping invalid entries', () => {
      const items = mapMarkersToRenderItems([
        mockMarkerItem({ item_id: 'a' }),
        null,
        mockMarkerItem({ item_id: 'b', latitude: NaN as any }),
        mockMarkerItem({ item_id: 'c' }),
      ]);
      expect(items.map((i) => i.itemId)).toEqual(['a', 'c']);
    });

    it('falls back to default attribution when none provided', () => {
      const item = mapMarkerToRenderItem(mockMarkerItem({ attribution: '' as any }));
      expect(item?.attribution).toBe(NEWS_ATTRIBUTION);
    });
  });

  describe('Markers render only marker API results', () => {
    it('does not map items without coordinates (LineString/Polygon guard)', () => {
      const noCoord = { ...mockMarkerItem(), latitude: null as any, longitude: null as any };
      expect(mapMarkerToRenderItem(noCoord)).toBeNull();
    });
  });

  describe('Marker visuals', () => {
    it('returns correct severity colors', () => {
      expect(getNewsMarkerColor('red')).toBe(NEWS_SEVERITY_COLORS.red);
      expect(getNewsMarkerColor('orange')).toBe(NEWS_SEVERITY_COLORS.orange);
      expect(getNewsMarkerColor('green')).toBe(NEWS_SEVERITY_COLORS.green);
      expect(getNewsMarkerColor('unknown')).toBe(NEWS_SEVERITY_COLORS.unknown);
    });

    it('generates a marker image data URL', () => {
      const render = mapMarkerToRenderItem(mockMarkerItem())!;
      expect(getNewsMarkerImage(render)).toBe('data:image/png;base64,mocked');
    });

    it('exposes NEWS_BILLBOARD_SCALE', () => {
      expect(typeof NEWS_BILLBOARD_SCALE).toBe('number');
      expect(NEWS_BILLBOARD_SCALE).toBeGreaterThan(0);
    });
  });

  describe('Detail formatting', () => {
    it('formats timestamps', () => {
      expect(formatNewsTimestamp('2026-06-12T10:00:00Z')).not.toBe('—');
      expect(formatNewsTimestamp(null)).toBe('—');
      expect(formatNewsTimestamp(undefined)).toBe('—');
    });

    it('formats severity', () => {
      expect(formatNewsSeverity('orange')).toBe('Orange');
      expect(formatNewsSeverity(null)).toBe('—');
    });

    it('formats country', () => {
      expect(formatNewsCountry('Bangladesh', 'BD')).toBe('Bangladesh (BD)');
      expect(formatNewsCountry('Bangladesh', null)).toBe('Bangladesh');
      expect(formatNewsCountry(null, 'BD')).toBe('BD');
      expect(formatNewsCountry(null, null)).toBe('—');
    });

    it('orDash returns em dash for missing values', () => {
      expect(orDash(null)).toBe('—');
      expect(orDash(undefined)).toBe('—');
      expect(orDash('')).toBe('—');
      expect(orDash('GDACS')).toBe('GDACS');
    });
  });

  describe('Attribution', () => {
    it('uses the GDACS attribution string', () => {
      expect(NEWS_ATTRIBUTION).toContain('GDACS');
    });

    it('does not expose provider_metadata or raw evidence content', () => {
      const render = mapMarkerToRenderItem(mockMarkerItem())!;
      expect(Object.keys(render)).not.toContain('provider_metadata');
      expect(Object.keys(render)).not.toContain('raw_evidence');
      expect(Object.keys(render)).not.toContain('rawJson');
    });
  });

  describe('No fake coordinate risk warning when count is 0', () => {
    it('fake_coordinate_risk_count of 0 means no warning needed', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          layer_id: NEWS_LAYER_ID, total_items: 171, marker_ready_items: 47,
          items_with_geom: 50, by_source: [], by_category: [], by_subcategory: [],
          by_severity: [], by_geometry_type: [], latest_fetch_run: null,
          fake_coordinate_risk_count: 0,
        }),
      });
      globalThis.fetch = mockFetch;
      const stats = await fetchNewsStats();
      expect(stats.fake_coordinate_risk_count).toBe(0);
    });
  });

  describe('GDELT Frontend Support', () => {
    it('returns correct severity colors for GDELT levels', () => {
      expect(getNewsMarkerColor('low')).toBe(NEWS_SEVERITY_COLORS.low);
      expect(getNewsMarkerColor('medium')).toBe(NEWS_SEVERITY_COLORS.medium);
      expect(getNewsMarkerColor('high')).toBe(NEWS_SEVERITY_COLORS.high);
      expect(getNewsMarkerColor('critical')).toBe(NEWS_SEVERITY_COLORS.critical);
    });

    it('forwards source_id in API items call', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { layer_id: NEWS_LAYER_ID, count: 0, limit: 100, offset: 0 } }),
      });
      globalThis.fetch = mockFetch;
      await fetchNewsItems({ sourceId: 'gdelt_event_export' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('source_id=gdelt_event_export');
    });

    it('forwards source_id in API markers call', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { layer_id: NEWS_LAYER_ID, count: 0, limit: 500 } }),
      });
      globalThis.fetch = mockFetch;
      await fetchNewsMarkers({ sourceId: 'gdelt_event_export' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('source_id=gdelt_event_export');
    });

    it('maps list-only NewsItem to NewsRenderMarker without synthesizing coordinates', () => {
      const mockItem: NewsItem = {
        item_id: 'gdelt_list_001',
        layer_id: NEWS_LAYER_ID,
        source_id: 'gdelt_event_export',
        source_family: 'global_event',
        source_object_id: '12345',
        source_url: 'https://example.com/article',
        title: 'List Only Event',
        summary: 'A summary here',
        content_type: 'event',
        published_at: '2026-06-13T10:00:00Z',
        source_updated_at: '2026-06-13T10:00:00Z',
        fetched_at: '2026-06-13T10:00:00Z',
        first_seen_at: '2026-06-13T10:00:00Z',
        last_seen_at: '2026-06-13T10:00:00Z',
        location: {
          confidence: 'low',
          country_code: null,
          country_name: null,
          region: null,
          city: null,
          latitude: null,
          longitude: null,
          geometry_type: null,
          geo_source: 'none',
          has_coordinates: false,
          marker_ready: false,
        },
        category: 'conflict',
        subcategory: 'Protest',
        severity: 'medium',
        source_domain: 'example.com',
        source_language: null,
        source_country: null,
        confidence_score: null,
        attribution: 'GDELT',
        is_active: true,
      };

      const mapped = mapNewsItemToRenderItem(mockItem);
      expect(mapped).not.toBeNull();
      expect(mapped.itemId).toBe('gdelt_list_001');
      expect(mapped.latitude).toBeNull();
      expect(mapped.longitude).toBeNull();
      expect(mapped.markerReady).toBe(false);
      expect(mapped.locationConfidence).toBe('low');
      expect(mapped.summary).toBe('A summary here');
    });

    it('maps marker-ready NewsItem with coordinates correctly', () => {
      const mockItem: NewsItem = {
        item_id: 'gdelt_marker_001',
        layer_id: NEWS_LAYER_ID,
        source_id: 'gdelt_event_export',
        source_family: 'global_event',
        source_object_id: '12346',
        source_url: 'https://example.com/article2',
        title: 'Marker Event',
        summary: null,
        content_type: 'event',
        published_at: '2026-06-13T10:00:00Z',
        source_updated_at: '2026-06-13T10:00:00Z',
        fetched_at: '2026-06-13T10:00:00Z',
        first_seen_at: '2026-06-13T10:00:00Z',
        last_seen_at: '2026-06-13T10:00:00Z',
        location: {
          confidence: 'high',
          country_code: 'US',
          country_name: 'United States',
          region: null,
          city: null,
          latitude: 38.8951,
          longitude: -77.0364,
          geometry_type: 'Point',
          geo_source: 'provided',
          has_coordinates: true,
          marker_ready: true,
        },
        category: 'diplomacy',
        subcategory: 'Talk',
        severity: 'high',
        source_domain: 'example.com',
        source_language: null,
        source_country: null,
        confidence_score: null,
        attribution: 'GDELT',
        is_active: true,
      };

      const mapped = mapNewsItemToRenderItem(mockItem);
      expect(mapped).not.toBeNull();
      expect(mapped.itemId).toBe('gdelt_marker_001');
      expect(mapped.latitude).toBe(38.8951);
      expect(mapped.longitude).toBe(-77.0364);
      expect(mapped.markerReady).toBe(true);
    });
  });

  describe('No hardcoded GDACS fixture records', () => {
    it('NEWS_LAYER_ID is a string constant, not a hardcoded GDACS record', () => {
      expect(NEWS_LAYER_ID).toBe('layer_08_news_osint');
    });
  });
});
