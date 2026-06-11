import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { WeatherObservationItem } from '@god-eyes/contracts';
import { LOCAL_LAYER_REGISTRY } from '../../../lib/useLayerRegistry';
import { fetchCurrentWeather, WEATHER_CURRENT_PATH } from '../weatherApi';
import {
  mapObservationToRenderItem,
  mapObservationsToRenderItems,
  WEATHER_ATTRIBUTION,
  WEATHER_LAYER_ID,
} from '../weatherTypes';
import {
  getTemperatureBucket,
  getTemperatureColor,
  getWeatherMarkerImage,
  TEMPERATURE_LEGEND,
  TEMPERATURE_BUCKET_COLORS,
} from '../weatherMarker';
import {
  degreesToCardinal,
  formatMeasurement,
  formatWindDirection,
  formatTimestamp,
  formatCondition,
} from '../weatherDetail';

// Mock the browser canvas environment for marker generation.
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
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
      }),
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mocked'),
    }),
  } as any;
});

function mockObservation(
  overrides: Partial<WeatherObservationItem> = {}
): WeatherObservationItem {
  return {
    observation_id: 'obs-1',
    observation_type: 'current',
    layer_id: WEATHER_LAYER_ID,
    source_id: 'open-meteo',
    location_id: 'loc-1',
    coordinates: {
      requested: { latitude: 52.52, longitude: 13.41 },
      resolved: { latitude: 52.5, longitude: 13.5 },
      elevation_m: 44.8,
    },
    weather: {
      temperature_c: 18.5,
      apparent_temperature_c: 17.2,
      wind_speed_kph: 12.3,
      wind_direction_deg: 225,
      wind_gust_kph: 18.7,
      humidity_percent: 65,
      pressure_hpa: 1013.2,
      precipitation_mm: 0,
      precipitation_probability_percent: 10,
      cloud_cover_percent: 45,
      weather_code: 2,
      weather_label: 'Partly Cloudy',
    },
    forecast_for: '2026-06-10T14:00:00Z',
    fetched_at: '2026-06-10T12:00:00Z',
    is_stale: false,
    raw_evidence_uri: null,
    provider_metadata: { surface_pressure_hpa: 1008.1, generation_time_ms: 2.2 },
    attribution: WEATHER_ATTRIBUTION,
    ...overrides,
  };
}

describe('Weather Layer (Layer 07) Tests', () => {
  describe('Layer Registration', () => {
    it('registers layer_07_weather as active, implemented, default OFF', () => {
      const weather = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_07_weather');
      expect(weather).toBeDefined();
      expect(weather?.status).toBe('active');
      expect(weather?.isImplemented).toBe(true);
      expect(weather?.isEnabled).toBe(false);
      expect(weather?.sourceRule).toBe('Open-Meteo');
    });

    it('does not keep a stale layer_07_infrastructure entry', () => {
      const stale = LOCAL_LAYER_REGISTRY.find((l) => l.layerId === 'layer_07_infrastructure');
      expect(stale).toBeUndefined();
    });
  });

  describe('API client', () => {
    it('calls the GOD EYES current endpoint path, not Open-Meteo', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });
      globalThis.fetch = mockFetch;

      await fetchCurrentWeather();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(WEATHER_CURRENT_PATH).toBe('/api/layers/layer_07_weather/weather/current');
      expect(calledUrl).toContain('/api/layers/layer_07_weather/weather/current');
      expect(calledUrl).not.toContain('open-meteo.com');
      expect(calledUrl).not.toContain('api.open-meteo.com');
    });

    it('builds query params safely (bbox, source_id, limit, offset)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });
      globalThis.fetch = mockFetch;

      await fetchCurrentWeather({ bbox: '10,20,30,40', sourceId: 'open-meteo', limit: 500, offset: 100 });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('bbox=10%2C20%2C30%2C40');
      expect(calledUrl).toContain('source_id=open-meteo');
      expect(calledUrl).toContain('limit=500');
      expect(calledUrl).toContain('offset=100');
    });

    it('omits undefined params and zero offset', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });
      globalThis.fetch = mockFetch;

      await fetchCurrentWeather({ limit: 2000 });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('bbox=');
      expect(calledUrl).not.toContain('source_id=');
      expect(calledUrl).not.toContain('offset=');
      expect(calledUrl).toContain('limit=2000');
    });

    it('throws a safe error on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal Server Error' } }),
      });
      await expect(fetchCurrentWeather()).rejects.toThrow('Internal Server Error');
    });

    it('handles empty data responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { count: 0 } }),
      });
      const res = await fetchCurrentWeather();
      expect(res.data).toEqual([]);
    });
  });

  describe('Render model mapping', () => {
    it('maps an observation into the render model using resolved coordinates', () => {
      const item = mapObservationToRenderItem(mockObservation());
      expect(item).not.toBeNull();
      expect(item?.kind).toBe('weather');
      expect(item?.latitude).toBe(52.5);
      expect(item?.longitude).toBe(13.5);
      expect(item?.requestedLatitude).toBe(52.52);
      expect(item?.temperatureC).toBe(18.5);
      expect(item?.weatherLabel).toBe('Partly Cloudy');
      expect(item?.surfacePressureHpa).toBe(1008.1);
      expect(item?.attribution).toBe(WEATHER_ATTRIBUTION);
    });

    it('skips items with missing/invalid resolved coordinates', () => {
      const bad = mockObservation({
        coordinates: {
          requested: { latitude: 1, longitude: 2 },
          resolved: { latitude: NaN as any, longitude: 13.5 },
          elevation_m: null,
        },
      });
      expect(mapObservationToRenderItem(bad)).toBeNull();

      const outOfRange = mockObservation({
        coordinates: {
          requested: { latitude: 1, longitude: 2 },
          resolved: { latitude: 200, longitude: 13.5 },
          elevation_m: null,
        },
      });
      expect(mapObservationToRenderItem(outOfRange)).toBeNull();
    });

    it('skips items with missing/invalid temperature_c', () => {
      const noTemp = mockObservation({
        weather: { ...mockObservation().weather, temperature_c: null as any },
      });
      expect(mapObservationToRenderItem(noTemp)).toBeNull();
    });

    it('keeps null optional weather fields as null', () => {
      const item = mapObservationToRenderItem(
        mockObservation({
          weather: {
            ...mockObservation().weather,
            apparent_temperature_c: null,
            wind_direction_deg: null,
            weather_label: null,
          },
        })
      );
      expect(item?.apparentTemperatureC).toBeNull();
      expect(item?.windDirectionDeg).toBeNull();
      expect(item?.weatherLabel).toBeNull();
    });

    it('maps arrays defensively, skipping invalid entries', () => {
      const items = mapObservationsToRenderItems([
        mockObservation({ observation_id: 'a' }),
        null,
        mockObservation({ observation_id: 'b', weather: { ...mockObservation().weather, temperature_c: NaN as any } }),
        mockObservation({ observation_id: 'c' }),
      ]);
      expect(items.map((i) => i.observationId)).toEqual(['a', 'c']);
    });

    it('falls back to the default attribution when none provided', () => {
      const item = mapObservationToRenderItem(mockObservation({ attribution: '' as any }));
      expect(item?.attribution).toBe(WEATHER_ATTRIBUTION);
    });
  });

  describe('Temperature buckets and colors', () => {
    it('classifies temperatures into the correct buckets', () => {
      expect(getTemperatureBucket(-5)).toBe('cold');
      expect(getTemperatureBucket(0)).toBe('cold');
      expect(getTemperatureBucket(5)).toBe('cool');
      expect(getTemperatureBucket(10)).toBe('cool');
      expect(getTemperatureBucket(15)).toBe('mild');
      expect(getTemperatureBucket(20)).toBe('mild');
      expect(getTemperatureBucket(25)).toBe('warm');
      expect(getTemperatureBucket(30)).toBe('warm');
      expect(getTemperatureBucket(35)).toBe('hot');
      expect(getTemperatureBucket(40)).toBe('hot');
      expect(getTemperatureBucket(45)).toBe('extreme');
    });

    it('maps buckets to colors', () => {
      expect(getTemperatureColor(-5)).toBe(TEMPERATURE_BUCKET_COLORS.cold);
      expect(getTemperatureColor(45)).toBe(TEMPERATURE_BUCKET_COLORS.extreme);
    });

    it('exposes a 6-entry ordered legend', () => {
      expect(TEMPERATURE_LEGEND).toHaveLength(6);
      expect(TEMPERATURE_LEGEND[0].bucket).toBe('cold');
      expect(TEMPERATURE_LEGEND[5].bucket).toBe('extreme');
    });

    it('produces a marker image data url', () => {
      const item = mapObservationToRenderItem(mockObservation())!;
      expect(getWeatherMarkerImage(item)).toBe('data:image/png;base64,mocked');
    });
  });

  describe('Detail formatting helpers', () => {
    it('converts degrees to cardinal directions', () => {
      expect(degreesToCardinal(0)).toBe('N');
      expect(degreesToCardinal(90)).toBe('E');
      expect(degreesToCardinal(180)).toBe('S');
      expect(degreesToCardinal(270)).toBe('W');
      expect(degreesToCardinal(225)).toBe('SW');
      expect(degreesToCardinal(null)).toBe('—');
    });

    it('formats measurements with units and missing values', () => {
      expect(formatMeasurement(18.5, '°C')).toBe('18.5 °C');
      expect(formatMeasurement(65, '%', 0)).toBe('65 %');
      expect(formatMeasurement(null, 'hPa')).toBe('—');
    });

    it('formats wind direction with cardinal', () => {
      expect(formatWindDirection(225)).toBe('225° (SW)');
      expect(formatWindDirection(null)).toBe('—');
    });

    it('formats timestamps defensively', () => {
      expect(formatTimestamp(null)).toBe('—');
      expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    });

    it('formats condition with fallbacks', () => {
      const item = mapObservationToRenderItem(mockObservation())!;
      expect(formatCondition(item)).toBe('Partly Cloudy');

      const noLabel = mapObservationToRenderItem(
        mockObservation({ weather: { ...mockObservation().weather, weather_label: null } })
      )!;
      expect(formatCondition(noLabel)).toBe('Code 2');
    });
  });

  describe('Attribution', () => {
    it('uses the Open-Meteo CC-BY 4.0 attribution string', () => {
      expect(WEATHER_ATTRIBUTION).toBe(
        'Weather data provided by Open-Meteo under CC-BY 4.0 licence.'
      );
    });
  });
});
