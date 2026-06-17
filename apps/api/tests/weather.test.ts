import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { weatherRoutes } from '../src/routes/weather/index.js';
import { query } from '../src/lib/db.js';

const NOW = new Date('2026-06-10T12:00:00.000Z');

const MOCK_OBSERVATIONS = [
  {
    observation_id: 'obs_001_current_berlin',
    layer_id: 'layer_07_weather',
    source_id: 'open-meteo',
    location_id: 'loc_berlin_001',
    observation_type: 'current',
    requested_latitude: 52.52,
    requested_longitude: 13.41,
    resolved_latitude: 52.5,
    resolved_longitude: 13.5,
    elevation_m: 44.812,
    temperature_c: 18.5,
    apparent_temperature_c: 17.2,
    wind_speed_kph: 12.3,
    wind_direction_deg: 225,
    wind_gust_kph: 18.7,
    humidity_percent: 65,
    pressure_hpa: 1013.2,
    precipitation_mm: 0.0,
    precipitation_probability_percent: null,
    cloud_cover_percent: 45,
    weather_code: 2,
    weather_label: 'Partly Cloudy',
    forecast_for: new Date('2026-06-10T14:00:00Z'),
    fetched_at: new Date('2026-06-10T12:00:00Z'),
    is_stale: false,
    raw_evidence_uri: 'raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json',
    surfacePressureHpa: '1008.1',
    generationTimeMs: '2.2119',
    attribution: 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
  },
  {
    observation_id: 'obs_002_current_london',
    layer_id: 'layer_07_weather',
    source_id: 'open-meteo',
    location_id: 'loc_london_002',
    observation_type: 'current',
    requested_latitude: 51.51,
    requested_longitude: -0.13,
    resolved_latitude: 51.5,
    resolved_longitude: -0.1,
    elevation_m: 25.0,
    temperature_c: 15.2,
    apparent_temperature_c: 14.0,
    wind_speed_kph: 8.5,
    wind_direction_deg: 180,
    wind_gust_kph: 12.0,
    humidity_percent: 72,
    pressure_hpa: 1018.5,
    precipitation_mm: 0.5,
    precipitation_probability_percent: null,
    cloud_cover_percent: 80,
    weather_code: 61,
    weather_label: 'Slight Rain',
    forecast_for: new Date('2026-06-10T14:00:00Z'),
    fetched_at: new Date('2026-06-10T12:00:00Z'),
    is_stale: false,
    raw_evidence_uri: 'raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json',
    surfacePressureHpa: null,
    generationTimeMs: null,
    attribution: 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
  },
  {
    observation_id: 'obs_003_hourly_berlin_15',
    layer_id: 'layer_07_weather',
    source_id: 'open-meteo',
    location_id: 'loc_berlin_001',
    observation_type: 'hourly',
    requested_latitude: 52.52,
    requested_longitude: 13.41,
    resolved_latitude: 52.5,
    resolved_longitude: 13.5,
    elevation_m: 44.812,
    temperature_c: 19.0,
    apparent_temperature_c: 18.0,
    wind_speed_kph: 14.0,
    wind_direction_deg: 230,
    wind_gust_kph: 20.0,
    humidity_percent: 60,
    pressure_hpa: 1012.0,
    precipitation_mm: 0.0,
    precipitation_probability_percent: 10,
    cloud_cover_percent: 40,
    weather_code: 2,
    weather_label: 'Partly Cloudy',
    forecast_for: new Date('2026-06-10T15:00:00Z'),
    fetched_at: new Date('2026-06-10T12:00:00Z'),
    is_stale: false,
    raw_evidence_uri: 'raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json',
    surfacePressureHpa: '1007.5',
    generationTimeMs: '2.5000',
    attribution: 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
  },
  {
    observation_id: 'obs_004_hourly_berlin_16',
    layer_id: 'layer_07_weather',
    source_id: 'open-meteo',
    location_id: 'loc_berlin_001',
    observation_type: 'hourly',
    requested_latitude: 52.52,
    requested_longitude: 13.41,
    resolved_latitude: 52.5,
    resolved_longitude: 13.5,
    elevation_m: 44.812,
    temperature_c: 20.0,
    apparent_temperature_c: 19.0,
    wind_speed_kph: 15.0,
    wind_direction_deg: 240,
    wind_gust_kph: 22.0,
    humidity_percent: 55,
    pressure_hpa: 1011.0,
    precipitation_mm: 0.0,
    precipitation_probability_percent: 5,
    cloud_cover_percent: 30,
    weather_code: 1,
    weather_label: 'Mainly Clear',
    forecast_for: new Date('2026-06-10T16:00:00Z'),
    fetched_at: new Date('2026-06-10T12:00:00Z'),
    is_stale: false,
    raw_evidence_uri: 'raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/batch_001.json',
    surfacePressureHpa: '1006.8',
    generationTimeMs: '2.5000',
    attribution: 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
  },
  {
    observation_id: 'obs_005_stale',
    layer_id: 'layer_07_weather',
    source_id: 'open-meteo',
    location_id: 'loc_old_005',
    observation_type: 'current',
    requested_latitude: 48.85,
    requested_longitude: 2.35,
    resolved_latitude: 48.8,
    resolved_longitude: 2.4,
    elevation_m: 50.0,
    temperature_c: 22.0,
    apparent_temperature_c: null,
    wind_speed_kph: null,
    wind_direction_deg: null,
    wind_gust_kph: null,
    humidity_percent: null,
    pressure_hpa: null,
    precipitation_mm: null,
    precipitation_probability_percent: null,
    cloud_cover_percent: null,
    weather_code: null,
    weather_label: null,
    forecast_for: new Date('2026-06-10T08:00:00Z'),
    fetched_at: new Date('2026-06-10T06:00:00Z'),
    is_stale: true,
    raw_evidence_uri: null,
    surfacePressureHpa: null,
    generationTimeMs: null,
    attribution: 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
  },
];

const MOCK_SOURCES = [
  {
    source_id: 'open-meteo',
    source_name: 'Open-Meteo',
    source_url: 'https://open-meteo.com/',
    licence: 'CC-BY 4.0',
    attribution: 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
    is_active: true,
  },
];

const MOCK_FETCH_RUNS = [
  {
    fetch_run_id: 'run_20260610T120000Z',
    source_id: 'open-meteo',
    layer_id: 'layer_07_weather',
    grid_resolution: '5deg',
    total_cells: 2664,
    successful_cells: 2664,
    failed_cells: 0,
    fetch_started_at: new Date('2026-06-10T12:00:00Z'),
    fetch_completed_at: new Date('2026-06-10T12:05:00Z'),
    api_calls_made: 54,
    raw_storage_path: 'raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T120000Z/',
    status: 'completed',
    error_message: null,
  },
  {
    fetch_run_id: 'run_20260610T060000Z',
    source_id: 'open-meteo',
    layer_id: 'layer_07_weather',
    grid_resolution: '5deg',
    total_cells: 2664,
    successful_cells: 2650,
    failed_cells: 14,
    fetch_started_at: new Date('2026-06-10T06:00:00Z'),
    fetch_completed_at: new Date('2026-06-10T06:06:00Z'),
    api_calls_made: 54,
    raw_storage_path: 'raw/layer_07_weather/open-meteo/2026/06/10/run_20260610T060000Z/',
    status: 'partial',
    error_message: '14 cells failed after retries',
  },
];

describe('Weather API', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(weatherRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Route registration - latest endpoint exists
  it('1. GET /api/layers/layer_07_weather/weather/latest returns observations', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    expect(body.meta.count).toBe(5);
    expect(body.meta.limit).toBe(200);
    expect(body.meta.offset).toBe(0);
    expect(body.meta.layer_id).toBe('layer_07_weather');
    expect(body.meta.source_id).toBe('open-meteo');
    expect(body.meta.attribution).toContain('Open-Meteo');
  });

  // 2. Latest endpoint returns full observation item shape
  it('2. Latest endpoint returns full observation item shape', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_OBSERVATIONS[0]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];

    expect(item.observation_id).toBe('obs_001_current_berlin');
    expect(item.observation_type).toBe('current');
    expect(item.layer_id).toBe('layer_07_weather');
    expect(item.source_id).toBe('open-meteo');
    expect(item.location_id).toBe('loc_berlin_001');

    expect(item.coordinates).toBeDefined();
    expect(item.coordinates.requested.latitude).toBe(52.52);
    expect(item.coordinates.requested.longitude).toBe(13.41);
    expect(item.coordinates.resolved.latitude).toBe(52.5);
    expect(item.coordinates.resolved.longitude).toBe(13.5);
    expect(item.coordinates.elevation_m).toBe(44.812);

    expect(item.weather).toBeDefined();
    expect(item.weather.temperature_c).toBe(18.5);
    expect(item.weather.apparent_temperature_c).toBe(17.2);
    expect(item.weather.wind_speed_kph).toBe(12.3);
    expect(item.weather.wind_direction_deg).toBe(225);
    expect(item.weather.wind_gust_kph).toBe(18.7);
    expect(item.weather.humidity_percent).toBe(65);
    expect(item.weather.pressure_hpa).toBe(1013.2);
    expect(item.weather.precipitation_mm).toBe(0.0);
    expect(item.weather.precipitation_probability_percent).toBeNull();
    expect(item.weather.cloud_cover_percent).toBe(45);
    expect(item.weather.weather_code).toBe(2);
    expect(item.weather.weather_label).toBe('Partly Cloudy');

    expect(item.forecast_for).toBeTypeOf('string');
    expect(item.fetched_at).toBeTypeOf('string');
    expect(item.is_stale).toBe(false);
    expect(item.raw_evidence_uri).toBeTypeOf('string');
    expect(item.attribution).toContain('Open-Meteo');
  });

  // 3. Latest endpoint includes provider_metadata when available
  it('3. Latest endpoint includes provider_metadata safe subset', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_OBSERVATIONS[0]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];

    expect(item.provider_metadata).toBeDefined();
    expect(item.provider_metadata.surface_pressure_hpa).toBe(1008.1);
    expect(item.provider_metadata.generation_time_ms).toBe(2.2119);
  });

  // 4. Latest endpoint handles null provider_metadata fields
  it('4. Latest endpoint returns null provider_metadata when no metadata', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_OBSERVATIONS[1]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];

    expect(item.provider_metadata).toBeNull();
  });

  // 5. Bbox filter works
  it('5. GET /weather/latest filters by bbox', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?bbox=-10,40,20,60',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ST_MakeEnvelope');
    expect(sql).toContain('geom &&');
  });

  // 6. Bbox validation - invalid format
  it('6. GET /weather/latest rejects invalid bbox', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?bbox=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  // 7. Bbox validation - out of range values
  it('7. GET /weather/latest rejects bbox with out of range values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?bbox=-200,0,200,100',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_BBOX');
  });

  // 8. Current endpoint filters observation_type=current
  it('8. GET /weather/current filters observation_type=current', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS.slice(0, 2));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/current',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('observation_type');
    const params = callArgs[1] as unknown[];
    expect(params).toContain('current');
  });

  // 9. Hourly endpoint filters observation_type=hourly
  it('9. GET /weather/hourly filters observation_type=hourly', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS.slice(2, 4));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/hourly',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('observation_type');
    const params = callArgs[1] as unknown[];
    expect(params).toContain('hourly');
  });

  // 10. Current endpoint returns current-only data
  it('10. Current endpoint returns only current observations', async () => {
    const currentObs = MOCK_OBSERVATIONS.filter((o) => o.observation_type === 'current');
    vi.mocked(query).mockResolvedValueOnce(currentObs);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/current',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    for (const item of body.data) {
      expect(item.observation_type).toBe('current');
    }
    expect(body.meta.layer_id).toBe('layer_07_weather');
  });

  // 11. Hourly endpoint returns hourly-only data
  it('11. Hourly endpoint returns only hourly observations', async () => {
    const hourlyObs = MOCK_OBSERVATIONS.filter((o) => o.observation_type === 'hourly');
    vi.mocked(query).mockResolvedValueOnce(hourlyObs);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/hourly',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    for (const item of body.data) {
      expect(item.observation_type).toBe('hourly');
    }
  });

  // 12. Hourly endpoint supports forecast_from/forecast_to
  it('12. Hourly endpoint filters by forecast_from', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS.slice(2, 4));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/hourly?forecast_from=2026-06-10T14:00:00Z',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('forecast_for >=');
  });

  // 13. Hourly endpoint supports forecast_to
  it('13. Hourly endpoint filters by forecast_to', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS.slice(2, 4));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/hourly?forecast_to=2026-06-10T16:00:00Z',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('forecast_for <=');
  });

  // 14. Nearby endpoint validates lat/lon
  it('14. GET /weather/nearby validates lat and lon', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=invalid&lon=10',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 15. Nearby endpoint rejects out of range lat
  it('15. GET /weather/nearby rejects lat out of range', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=100&lon=10',
    });

    expect(response.statusCode).toBe(400);
  });

  // 16. Nearby endpoint rejects out of range lon
  it('16. GET /weather/nearby rejects lon out of range', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=50&lon=200',
    });

    expect(response.statusCode).toBe(400);
  });

  // 17. Nearby endpoint returns valid data
  it('17. GET /weather/nearby returns observations with distance', async () => {
    const nearbyRows = MOCK_OBSERVATIONS.slice(0, 2).map((o) => ({
      ...o,
      distance_km: 5.2,
    }));
    vi.mocked(query).mockResolvedValueOnce(nearbyRows);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=52.0&lon=13.0',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data[0].distance_km).toBeDefined();
    expect(body.meta.lat).toBe(52);
    expect(body.meta.lon).toBe(13);
    expect(body.meta.radius_km).toBe(200);
  });

  // 18. Nearby endpoint uses PostGIS spatial query
  it('18. Nearby endpoint SQL uses ST_DWithin', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=52.0&lon=13.0',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ST_DWithin');
  });

  // 19. Nearby endpoint validates radius_km
  it('19. Nearby endpoint rejects invalid radius_km', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=52.0&lon=13.0&radius_km=-1',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 20. Nearby endpoint caps radius_km
  it('20. Nearby endpoint rejects radius_km > max', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=52.0&lon=13.0&radius_km=99999',
    });

    expect(response.statusCode).toBe(400);
  });

  // 21. Source_id filtering
  it('21. Latest endpoint filters by source_id', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?source_id=open-meteo',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id');
  });

  // 22. Invalid observation_type returns 400
  it('22. Rejects invalid observation_type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?observation_type=daily',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 23. Invalid timestamp returns 400
  it('23. Rejects invalid forecast_from timestamp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?forecast_from=not-a-date',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 24. forecast_from before forecast_to validation
  it('24. Rejects forecast_from after forecast_to', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?forecast_from=2026-06-11T00:00:00Z&forecast_to=2026-06-10T00:00:00Z',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 25. Limit/offset validation
  it('25. Limit and offset are parsed correctly', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?limit=10&offset=5',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta.limit).toBe(10);
    expect(body.meta.offset).toBe(5);

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastTwo = params.slice(-2);
    expect(lastTwo).toEqual([10, 5]);
  });

  // 26. Empty result returns 200 with empty data
  it('26. Empty result returns 200 with empty data array', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.meta.count).toBe(0);
  });

  // 27. SQL is parameterized
  it('27. SQL uses parameterized queries', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];

    expect(sql).toContain('$1');
    expect(params).toBeDefined();
    expect(params.length).toBeGreaterThanOrEqual(1);
  });

  // 28. weather_sources endpoint
  it('28. GET /weather/sources returns weather sources with attribution', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_SOURCES);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/sources',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.count).toBe(1);
    expect(body.meta.layer_id).toBe('layer_07_weather');

    const source = body.data[0];
    expect(source.source_id).toBe('open-meteo');
    expect(source.source_name).toBe('Open-Meteo');
    expect(source.licence).toBe('CC-BY 4.0');
    expect(source.attribution).toContain('Open-Meteo');
    expect(source.is_active).toBe(true);
  });

  // 29. Fetch runs endpoint
  it('29. GET /weather/fetch-runs returns fetch runs', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_FETCH_RUNS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/fetch-runs',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.count).toBe(2);

    const run = body.data[0];
    expect(run.fetch_run_id).toBe('run_20260610T120000Z');
    expect(run.source_id).toBe('open-meteo');
    expect(run.grid_resolution).toBe('5deg');
    expect(run.total_cells).toBe(2664);
    expect(run.successful_cells).toBe(2664);
    expect(run.failed_cells).toBe(0);
    expect(run.status).toBe('completed');
    expect(run.api_calls_made).toBe(54);
    expect(run.fetch_started_at).toBeTypeOf('string');
    expect(run.fetch_completed_at).toBeTypeOf('string');
  });

  // 30. Fetch runs endpoint supports source_id and status filters
  it('30. Fetch runs endpoint supports source_id filter', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUNS[0]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/fetch-runs?source_id=open-meteo',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id');
  });

  // 31. Fetch runs endpoint supports status filter
  it('31. Fetch runs endpoint supports status filter', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUNS[0]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/fetch-runs?status=completed',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('status');
  });

  // 32. Fetch runs validates status
  it('32. Fetch runs rejects invalid status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/fetch-runs?status=invalid',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 33. No external network calls
  it('33. No network calls from weather endpoints', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // 34. No frontend imports
  it('34. No frontend imports in weather route', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/routes/weather/index.ts', 'utf-8');
    expect(source).not.toContain('frontend');
    expect(source).not.toContain('components');
    expect(source).not.toContain('React');
    expect(source).not.toContain('jsx');
  });

  // 35. No secrets exposed
  it('35. No secrets exposed in responses', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('secret');
    expect(bodyStr).not.toContain('api_key');
    expect(bodyStr).not.toContain('token');
  });

  // 36. Internal error on DB failure
  it('36. Returns safe internal error on DB failure', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('SELECT');
    expect(body.error.message).not.toContain('connection');
  });

  // 37. Limit is capped at maximum
  it('37. Limit is capped at MAX_LIMIT', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?limit=99999',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    expect(params).toContain(5000);
  });

  // 38. Invalid limit returns 400
  it('38. Invalid limit returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?limit=abc',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  // 39. Invalid offset returns 400
  it('39. Invalid offset returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest?offset=-1',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 40. Fetch runs endpoint orders by fetch_started_at DESC
  it('40. Fetch runs SQL orders by fetch_started_at DESC', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_FETCH_RUNS);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/fetch-runs',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ORDER BY f.fetch_started_at DESC');
  });

  // 41. Weather sources endpoint handles empty sources
  it('41. Sources endpoint handles empty result', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/sources',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.meta.count).toBe(0);
  });

  // 42. Fetch runs works with limit/offset
  it('42. Fetch runs pagination with limit/offset', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUNS[0]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/fetch-runs?limit=1&offset=1',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta.limit).toBe(1);
    expect(body.meta.offset).toBe(1);

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastTwo = params.slice(-2);
    expect(lastTwo).toEqual([1, 1]);
  });

  // 43. Latest endpoint joins weather_locations and weather_sources
  it('43. Latest SQL joins weather_locations and weather_sources', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('weather_locations');
    expect(sql).toContain('weather_sources');
  });

  // 44. Nearby endpoint supports observation_type filter
  it('44. Nearby endpoint supports observation_type filter', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/nearby?lat=52.0&lon=13.0&observation_type=current',
    });

    expect(response.statusCode).toBe(200);

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('observation_type');
  });

  // 45. Hourly endpoint supports forecast time range with from/to
  it('45. Hourly endpoint with both forecast_from and forecast_to', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS.slice(2, 4));

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/hourly?forecast_from=2026-06-10T14:00:00Z&forecast_to=2026-06-10T18:00:00Z',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(2);
  });

  // 46. Latest endpoint orders by forecast_for DESC
  it('46. Latest SQL orders by forecast_for DESC, fetched_at DESC', async () => {
    vi.mocked(query).mockResolvedValueOnce(MOCK_OBSERVATIONS);

    await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ORDER BY o.forecast_for DESC, o.fetched_at DESC');
  });

  // 47. Stale observations have is_stale: true
  it('47. Stale observations return is_stale: true', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_OBSERVATIONS[4]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data[0].is_stale).toBe(true);
    expect(body.data[0].weather.temperature_c).toBe(22.0);
    expect(body.data[0].raw_evidence_uri).toBeNull();
  });
});

describe('Weather API Numeric Coercion', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(weatherRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const STRING_OBSERVATIONS = [
    {
      observation_id: 'obs_string_001',
      layer_id: 'layer_07_weather',
      source_id: 'open-meteo',
      location_id: 'loc_string_001',
      observation_type: 'current',
      requested_latitude: '52.52',
      requested_longitude: '13.41',
      resolved_latitude: '52.5',
      resolved_longitude: '13.5',
      elevation_m: '44.812',
      temperature_c: '18.5',
      apparent_temperature_c: '17.2',
      wind_speed_kph: '12.3',
      wind_direction_deg: '225',
      wind_gust_kph: '18.7',
      humidity_percent: '65',
      pressure_hpa: '1013.2',
      precipitation_mm: '0.0',
      precipitation_probability_percent: null,
      cloud_cover_percent: '45',
      weather_code: '2',
      weather_label: 'Partly Cloudy',
      forecast_for: new Date('2026-06-10T14:00:00Z'),
      fetched_at: new Date('2026-06-10T12:00:00Z'),
      is_stale: false,
      raw_evidence_uri: 'raw/path/batch.json',
      surfacePressureHpa: '1008.1',
      generationTimeMs: '2.2119',
      attribution: 'Weather data provided by Open-Meteo under CC-BY 4.0 licence.',
    },
  ];

  it('1. All numeric fields coerced from string to number', async () => {
    vi.mocked(query).mockResolvedValueOnce(STRING_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];

    expect(item.coordinates.requested.latitude).toBeTypeOf('number');
    expect(item.coordinates.requested.longitude).toBeTypeOf('number');
    expect(item.coordinates.resolved.latitude).toBeTypeOf('number');
    expect(item.coordinates.resolved.longitude).toBeTypeOf('number');
    expect(item.coordinates.elevation_m).toBeTypeOf('number');

    expect(item.weather.temperature_c).toBeTypeOf('number');
    expect(item.weather.apparent_temperature_c).toBeTypeOf('number');
    expect(item.weather.wind_speed_kph).toBeTypeOf('number');
    expect(item.weather.wind_direction_deg).toBeTypeOf('number');
    expect(item.weather.wind_gust_kph).toBeTypeOf('number');
    expect(item.weather.humidity_percent).toBeTypeOf('number');
    expect(item.weather.pressure_hpa).toBeTypeOf('number');
    expect(item.weather.precipitation_mm).toBeTypeOf('number');
    expect(item.weather.cloud_cover_percent).toBeTypeOf('number');
    expect(item.weather.weather_code).toBeTypeOf('number');
  });

  it('2. Provider_metadata values coerced from string to number', async () => {
    vi.mocked(query).mockResolvedValueOnce(STRING_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];

    expect(item.provider_metadata.surface_pressure_hpa).toBeTypeOf('number');
    expect(item.provider_metadata.surface_pressure_hpa).toBe(1008.1);
    expect(item.provider_metadata.generation_time_ms).toBeTypeOf('number');
    expect(item.provider_metadata.generation_time_ms).toBe(2.2119);
  });

  it('3. Null numeric fields stay null', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_OBSERVATIONS[4]]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];

    expect(item.weather.apparent_temperature_c).toBeNull();
    expect(item.weather.wind_speed_kph).toBeNull();
    expect(item.weather.humidity_percent).toBeNull();
    expect(item.weather.weather_code).toBeNull();
    expect(item.weather.weather_label).toBeNull();
    expect(item.provider_metadata).toBeNull();
  });

  it('4. Zod validation with all-string numeric rows', async () => {
    vi.mocked(query).mockResolvedValueOnce(STRING_OBSERVATIONS);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/layer_07_weather/weather/latest',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
