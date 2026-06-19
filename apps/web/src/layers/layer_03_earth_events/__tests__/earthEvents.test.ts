import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import { fetchEarthEventsLatest } from '../../../lib/api';
import type { EarthEventsLatestResponse } from '@god-eyes/contracts';

function mockResponse(
  overrides: Partial<EarthEventsLatestResponse> = {}
): EarthEventsLatestResponse {
  return {
    events: [],
    metadata: {
      count: 0,
      generatedAt: '2026-06-12T12:00:00.000Z',
    },
    ...overrides,
  };
}

describe('Earth Events Layer (Layer 03) Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Layer Registration', () => {
    it('registers layer_03_earth_events as active and implemented', () => {
      const layer = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_03_earth_events');
      expect(layer).toBeDefined();
      expect(layer?.status).toBe('active');
      expect(layer?.isImplemented).toBe(true);
      expect(layer?.category).toBe('Natural Phenomena');
      expect(layer?.sourceRule).toContain('USGS');
    });

    it('is implemented in the frontend (has a React hook module)', () => {
      const layer = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_03_earth_events');
      expect(layer?.isImplemented).toBe(true);
      expect(typeof layer?.isEnabled).toBe('boolean');
    });
  });

  describe('API client — fetchEarthEventsLatest', () => {
    it('hits the GOD EYES API, not USGS / NASA EONET directly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse(),
      });
      globalThis.fetch = mockFetch as any;

      await fetchEarthEventsLatest();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/layers/earth-events/latest');
      expect(url).not.toContain('usgs.gov');
      expect(url).not.toContain('eonet.gsfc.nasa.gov');
    });

    it('applies default earthquake event_type and limit=200', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse(),
      });
      globalThis.fetch = mockFetch as any;

      await fetchEarthEventsLatest();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('event_type=earthquake');
      expect(url).toContain('limit=200');
    });

    it('forwards caller-provided params and clamps limit at 200', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse(),
      });
      globalThis.fetch = mockFetch as any;

      await fetchEarthEventsLatest({ limit: 9999, event_type: 'wildfire' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('event_type=wildfire');
      // API helper clamps limit to 200 to protect the backend.
      expect(url).toContain('limit=200');
      expect(url).not.toContain('limit=9999');
    });

    it('passes a custom limit when within the 200 cap', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse(),
      });
      globalThis.fetch = mockFetch as any;

      await fetchEarthEventsLatest({ limit: 50 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('limit=50');
    });

    it('forwards an abort signal to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse(),
      });
      globalThis.fetch = mockFetch as any;
      const ctrl = new AbortController();
      await fetchEarthEventsLatest({ limit: 5 }, ctrl.signal);
      const init = mockFetch.mock.calls[0][1] as RequestInit | undefined;
      expect(init?.signal).toBe(ctrl.signal);
    });

    it('returns the parsed response on success', async () => {
      const expected = mockResponse({ metadata: { count: 0, generatedAt: '2026-06-12T12:00:00.000Z' } });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => expected,
      }) as any;

      const res = await fetchEarthEventsLatest();
      expect(res).toBe(expected);
    });

    it('throws a clear error on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }) as any;

      await expect(fetchEarthEventsLatest()).rejects.toThrow(/503/);
    });

    it('handles empty events array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse({ events: [] }),
      }) as any;

      const res = await fetchEarthEventsLatest();
      expect(res.events).toEqual([]);
      expect(res.metadata.count).toBe(0);
    });
  });
});
