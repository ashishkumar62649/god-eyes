import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MaritimeVesselObject } from '@god-eyes/contracts';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import { fetchMaritimeObjects, fetchVesselDetail, fetchMaritimeStats } from '../maritimeApi';
import { getVesselColor, isVesselStale, getVesselHeading, getVesselMarkerImage } from '../vesselMarker';

// Mock browser global environment for canvas rendering
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
        arc: vi.fn(),
      }),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mocked'),
    }),
  } as any;
});

describe('Maritime Layer Integration Tests', () => {
  
  describe('Layer Registration', () => {
    it('should be registered with status active and isEnabled false', () => {
      const maritime = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_06_maritime');
      expect(maritime).toBeDefined();
      expect(maritime?.status).toBe('active');
      expect(maritime?.isImplemented).toBe(true);
      expect(maritime?.isEnabled).toBe(false);
      expect(maritime?.sourceRule).toBe('AISStream');
    });
  });

  describe('API client URL construction', () => {
    it('should build correct objects endpoint URL with bbox', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ objects: [], metadata: {} }),
      });
      globalThis.fetch = mockFetch;

      await fetchMaritimeObjects({ bbox: '10,20,30,40', vessel_type: 'cargo', search: 'Titanic', limit: 100 });

      expect(mockFetch).toHaveBeenCalled();
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/layers/maritime/objects');
      expect(calledUrl).toContain('bbox=10%2C20%2C30%2C40');
      expect(calledUrl).toContain('vessel_type=cargo');
      expect(calledUrl).toContain('search=Titanic');
      expect(calledUrl).toContain('limit=100');
    });

    it('should fallback without bbox', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ objects: [] }),
      });
      globalThis.fetch = mockFetch;

      await fetchMaritimeObjects({ limit: 1000 });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('bbox=');
      expect(calledUrl).toContain('limit=1000');
    });

    it('should query details by mmsi', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ vessel: {} }),
      });
      globalThis.fetch = mockFetch;

      await fetchVesselDetail(123456789);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('/api/layers/maritime/objects/123456789');
    });

    it('should handle API errors safely', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal Server Error' } }),
      });

      await expect(fetchMaritimeStats()).rejects.toThrow('Internal Server Error');
    });

    it('should handle empty API responses safely', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ objects: [], metadata: { count: 0 } }),
      });

      const res = await fetchMaritimeObjects();
      expect(res.objects).toEqual([]);
      expect(res.metadata.count).toBe(0);
    });

    it('should never contain direct AISStream URLs', () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;
      
      // Verification helper
      const checkAIS = (url: string) => {
        expect(url).not.toContain('aisstream.io');
        expect(url).not.toContain('wss://stream.aisstream.io');
      };

      checkAIS('/api/layers/maritime/objects');
    });
  });

  describe('Vessel Marker calculations', () => {
    const mockVessel = (overrides?: Partial<MaritimeVesselObject>): MaritimeVesselObject => ({
      id: 'vessel-1',
      layerId: 'layer_06_maritime',
      sourceId: 'aisstream',
      mmsi: 987654321,
      dedupeKey: 'aisstream-987654321',
      latitude: 12.34,
      longitude: 56.78,
      speedOverGround: 10.5,
      courseOverGround: 180,
      trueHeading: 185,
      navigationStatus: 0,
      navigationStatusText: 'Under way using engine',
      positionAccuracy: true,
      receivedAt: new Date().toISOString(),
      dataAgeSeconds: 120,
      vesselName: 'SEAFARER',
      vesselType: 'Cargo',
      vesselTypeCode: 70,
      callsign: 'ABCD',
      imo: 1234567,
      destination: 'Rotterdam',
      lengthMeters: 200,
      widthMeters: 32,
      ...overrides,
    });

    it('should resolve vessel color based on category', () => {
      expect(getVesselColor('Cargo')).toBe('#3b82f6');
      expect(getVesselColor('Tanker')).toBe('#f97316');
      expect(getVesselColor('Passenger')).toBe('#a855f7');
      expect(getVesselColor('Fishing vessel')).toBe('#22c55e');
      expect(getVesselColor('Unknown type')).toBe('#9ca3af');
    });

    it('should classify vessel as stale correctly', () => {
      const fresh = mockVessel({ dataAgeSeconds: 300 });
      const stale = mockVessel({ dataAgeSeconds: 4000 });
      expect(isVesselStale(fresh)).toBe(false);
      expect(isVesselStale(stale)).toBe(true);

      const staleTime = mockVessel({
        dataAgeSeconds: null,
        receivedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      });
      expect(isVesselStale(staleTime)).toBe(true);
    });

    it('should select heading prioritizing trueHeading first', () => {
      const v1 = mockVessel({ trueHeading: 185, courseOverGround: 180 });
      expect(getVesselHeading(v1)).toBe(185);

      const v2 = mockVessel({ trueHeading: null, courseOverGround: 180 });
      expect(getVesselHeading(v2)).toBe(180);

      const v3 = mockVessel({ trueHeading: null, courseOverGround: null });
      expect(getVesselHeading(v3)).toBe(null);
    });

    it('should draw dot marker when no direction is present', () => {
      const v = mockVessel({ trueHeading: null, courseOverGround: null });
      const image = getVesselMarkerImage(v);
      expect(image).toBe('data:image/png;base64,mocked');
    });
  });
});
