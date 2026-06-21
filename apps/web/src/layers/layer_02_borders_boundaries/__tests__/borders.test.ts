import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import { fetchBordersBoundariesCountries } from '../../../lib/api';
import type { BordersBoundariesFeatureCollection } from '@god-eyes/contracts';

function mockCollection(
  overrides: Partial<BordersBoundariesFeatureCollection> = {}
): BordersBoundariesFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [],
    meta: {
      count: 0,
      limit: 250,
      sourceId: 'natural-earth',
      sourceName: 'Natural Earth',
      localDevOnly: true,
      productionApproved: false,
      indiaCompliant: false,
      caveat: 'Local dev only. Disputed territories labeled.',
    },
    ...overrides,
  } as BordersBoundariesFeatureCollection;
}

describe('Borders & Boundaries Layer (Layer 02) Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Layer Registration', () => {
    it('registers layer_02_borders_boundaries as active, implemented, default ON', () => {
      const layer = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_02_borders_boundaries');
      expect(layer).toBeDefined();
      expect(layer?.status).toBe('active');
      expect(layer?.isImplemented).toBe(true);
      expect(layer?.isEnabled).toBe(true);
      expect(layer?.category).toBe('Geography');
      expect(layer?.sourceRule).toContain('Natural Earth');
    });

    it('does not collide with layer_02 or other layer IDs', () => {
      const ids = LOCAL_LAYER_REGISTRY.map((l) => l.layerId);
      const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dups).toEqual([]);
    });
  });

  describe('API client — fetchBordersBoundariesCountries', () => {
    it('hits the GOD EYES API, never the upstream natural-earth source', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCollection(),
      });
      globalThis.fetch = mockFetch as any;

      await fetchBordersBoundariesCountries();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/layers/borders-boundaries/countries');
      expect(url).not.toContain('naturalearthdata.com');
      expect(url).not.toContain('openstreetmap.org');
    });

    it('applies default limit and simplify params', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCollection(),
      });
      globalThis.fetch = mockFetch as any;

      await fetchBordersBoundariesCountries();

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('limit=250');
      expect(url).toContain('simplify=0.05');
    });

    it('respects caller-provided limit and simplify', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCollection(),
      });
      globalThis.fetch = mockFetch as any;

      await fetchBordersBoundariesCountries({ limit: 50, simplify: 0.5 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('limit=50');
      expect(url).toContain('simplify=0.5');
    });

    it('forwards an abort signal to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCollection(),
      });
      globalThis.fetch = mockFetch as any;
      const ctrl = new AbortController();
      await fetchBordersBoundariesCountries({ limit: 10 }, ctrl.signal);
      const init = mockFetch.mock.calls[0][1] as RequestInit | undefined;
      expect(init?.signal).toBe(ctrl.signal);
    });

    it('returns the parsed FeatureCollection on success', async () => {
      const expected = mockCollection({ meta: { ...mockCollection().meta, count: 7, limit: 250 } });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => expected,
      }) as any;

      const res = await fetchBordersBoundariesCountries();
      expect(res).toBe(expected);
      expect(res.type).toBe('FeatureCollection');
      expect(res.meta.count).toBe(7);
    });

    it('throws a clear error on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }) as any;

      await expect(fetchBordersBoundariesCountries()).rejects.toThrow(/500/);
    });

    it('handles empty features array', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCollection({ features: [] }),
      }) as any;

      const res = await fetchBordersBoundariesCountries();
      expect(res.features).toEqual([]);
    });
  });
});
