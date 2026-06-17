import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { newsRoutes } from '../src/routes/news/index.js';
import { query } from '../src/lib/db.js';

const LAYER_ID = 'layer_08_news_osint';
let app: ReturnType<typeof Fastify>;

const MOCK_POINT_ITEM = {
  item_id: 'gdacs_point_001',
  layer_id: LAYER_ID,
  source_id: 'gdacs',
  source_family: 'disaster_alert',
  source_object_id: 'EO-2026-001',
  source_url: 'https://www.gdacs.org/report.aspx?eventid=12345',
  title: 'Tropical Cyclone Warning - Pacific',
  summary: 'Category 4 tropical cyclone approaching Fiji.',
  content_type: 'disaster_alert',
  published_at: new Date('2026-06-10T12:00:00Z'),
  source_updated_at: new Date('2026-06-10T13:00:00Z'),
  fetched_at: new Date('2026-06-10T12:30:00Z'),
  first_seen_at: new Date('2026-06-10T12:00:00Z'),
  last_seen_at: new Date('2026-06-10T12:30:00Z'),
  location_confidence: 'high',
  country_code: 'FJI',
  country_name: 'Fiji',
  region: 'Oceania',
  city: null,
  latitude: -18.0,
  longitude: 178.0,
  geometry_type: 'Point',
  geo_source: 'provided',
  has_coordinates: true,
  marker_ready: true,
  category: 'Storm',
  subcategory: 'Tropical Cyclone',
  severity: 'red',
  source_domain: 'gdacs.org',
  source_language: 'en',
  source_country: null,
  confidence_score: 0.95,
  attribution: 'GDACS - Global Disaster Alert and Coordination System',
  is_active: true,
};

const MOCK_LINESTRING_ITEM = {
  item_id: 'gdacs_linestring_001',
  layer_id: LAYER_ID,
  source_id: 'gdacs',
  source_family: 'disaster_alert',
  source_object_id: 'EO-2026-002',
  source_url: 'https://www.gdacs.org/report.aspx?eventid=12346',
  title: 'Earthquake - Pacific Ring of Fire',
  summary: 'Seismic activity detected along fault line.',
  content_type: 'disaster_alert',
  published_at: new Date('2026-06-09T08:00:00Z'),
  source_updated_at: new Date('2026-06-09T09:00:00Z'),
  fetched_at: new Date('2026-06-09T08:30:00Z'),
  first_seen_at: new Date('2026-06-09T08:00:00Z'),
  last_seen_at: new Date('2026-06-09T08:30:00Z'),
  location_confidence: 'medium',
  country_code: 'JPN',
  country_name: 'Japan',
  region: 'Asia',
  city: null,
  latitude: null,
  longitude: null,
  geometry_type: 'LineString',
  geo_source: 'provided',
  has_coordinates: false,
  marker_ready: false,
  category: 'Earthquake',
  subcategory: 'Tectonic',
  severity: 'orange',
  source_domain: 'gdacs.org',
  source_language: 'en',
  source_country: null,
  confidence_score: 0.85,
  attribution: 'GDACS - Global Disaster Alert and Coordination System',
  is_active: true,
};

const MOCK_POLYGON_ITEM = {
  item_id: 'gdacs_polygon_001',
  layer_id: LAYER_ID,
  source_id: 'gdacs',
  source_family: 'disaster_alert',
  source_object_id: 'EO-2026-003',
  source_url: 'https://www.gdacs.org/report.aspx?eventid=12347',
  title: 'Flood Warning - Southeast Asia',
  summary: 'Widespread flooding predicted across Mekong Delta.',
  content_type: 'disaster_alert',
  published_at: new Date('2026-06-08T06:00:00Z'),
  source_updated_at: new Date('2026-06-08T07:00:00Z'),
  fetched_at: new Date('2026-06-08T06:30:00Z'),
  first_seen_at: new Date('2026-06-08T06:00:00Z'),
  last_seen_at: new Date('2026-06-08T06:30:00Z'),
  location_confidence: 'low',
  country_code: 'VNM',
  country_name: 'Vietnam',
  region: 'Asia',
  city: 'Ho Chi Minh City',
  latitude: null,
  longitude: null,
  geometry_type: 'Polygon',
  geo_source: 'provided',
  has_coordinates: false,
  marker_ready: false,
  category: 'Flood',
  subcategory: 'Riverine',
  severity: 'red',
  source_domain: 'gdacs.org',
  source_language: 'en',
  source_country: null,
  confidence_score: 0.75,
  attribution: 'GDACS - Global Disaster Alert and Coordination System',
  is_active: true,
};

const MOCK_SOURCE = {
  source_id: 'gdacs',
  layer_id: LAYER_ID,
  source_family: 'disaster_alert',
  display_name: 'GDACS',
  endpoint_url: 'https://www.gdacs.org/',
  auth_type: 'none',
  attribution: 'GDACS - Global Disaster Alert and Coordination System',
  license: 'CC BY 4.0',
  enabled: true,
  last_fetched_at: new Date('2026-06-10T12:00:00Z'),
  last_error: null,
  update_frequency_minutes: 60,
};

const MOCK_FETCH_RUN = {
  fetch_run_id: 'run_gdacs_20260610T120000Z',
  layer_id: LAYER_ID,
  source_id: 'gdacs',
  source_family: 'disaster_alert',
  run_type: 'ingestion',
  status: 'success',
  started_at: new Date('2026-06-10T12:00:00Z'),
  completed_at: new Date('2026-06-10T12:05:00Z'),
  fetched_item_count: 171,
  normalized_item_count: 171,
  marker_ready_count: 47,
  skipped_item_count: 0,
  error_message: null,
  created_at: new Date('2026-06-10T12:05:00Z'),
};

describe('Layer 08 News & OSINT API', () => {
  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(newsRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Route registration - items endpoint
  it('1. GET /api/layers/layer_08_news_osint/news/items returns news items', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM, MOCK_LINESTRING_ITEM, MOCK_POLYGON_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 3 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    expect(body.meta.count).toBe(3);
    expect(body.meta.limit).toBe(50);
    expect(body.meta.offset).toBe(0);
    expect(body.meta.layer_id).toBe(LAYER_ID);
    expect(body.meta.total).toBe(3);
  });

  // 2. Items endpoint returns full item shape
  it('2. Items endpoint returns full news item shape with location', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];

    expect(item.item_id).toBe('gdacs_point_001');
    expect(item.layer_id).toBe(LAYER_ID);
    expect(item.source_id).toBe('gdacs');
    expect(item.source_family).toBe('disaster_alert');
    expect(item.source_object_id).toBe('EO-2026-001');
    expect(item.source_url).toContain('gdacs.org');
    expect(item.title).toBe('Tropical Cyclone Warning - Pacific');
    expect(item.summary).toContain('Fiji');
    expect(item.content_type).toBe('disaster_alert');
    expect(item.published_at).toBeTypeOf('string');
    expect(item.fetched_at).toBeTypeOf('string');
    expect(item.first_seen_at).toBeTypeOf('string');
    expect(item.last_seen_at).toBeTypeOf('string');

    expect(item.location).toBeDefined();
    expect(item.location.confidence).toBe('high');
    expect(item.location.country_code).toBe('FJI');
    expect(item.location.country_name).toBe('Fiji');
    expect(item.location.region).toBe('Oceania');
    expect(item.location.latitude).toBe(-18.0);
    expect(item.location.longitude).toBe(178.0);
    expect(item.location.geometry_type).toBe('Point');
    expect(item.location.geo_source).toBe('provided');
    expect(item.location.has_coordinates).toBe(true);
    expect(item.location.marker_ready).toBe(true);

    expect(item.category).toBe('Storm');
    expect(item.subcategory).toBe('Tropical Cyclone');
    expect(item.severity).toBe('red');
    expect(item.source_domain).toBe('gdacs.org');
    expect(item.source_language).toBe('en');
    expect(item.confidence_score).toBe(0.95);
    expect(item.attribution).toContain('GDACS');
    expect(item.is_active).toBe(true);
  });

  // 3. Items filters by source_id
  it('3. Items filters by source_id', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=gdacs`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id');
    const params = callArgs[1] as unknown[];
    expect(params).toContain('gdacs');
  });

  // 4. Items filters by category
  it('4. Items filters by category', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?category=Storm`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('category');
  });

  // 5. Items filters by subcategory
  it('5. Items filters by subcategory', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?subcategory=Tropical+Cyclone`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('subcategory');
  });

  // 6. Items filters by severity
  it('6. Items filters by severity', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?severity=red`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('severity');
  });

  // 7. Items filters by marker_ready
  it('7. Items filters by marker_ready', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?marker_ready=true`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('marker_ready');
    const params = callArgs[1] as unknown[];
    expect(params).toContain(true);
  });

  // 8. Items filters by country_code
  it('8. Items filters by country_code', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?country_code=FJI`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('country_code');
  });

  // 9. Items search filters title/summary
  it('9. Items search filters title/summary', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?search=Tropical`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ILIKE');
  });

  // 10. Items pagination
  it('10. Items pagination with limit and offset', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?limit=5&offset=10`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.meta.limit).toBe(5);
    expect(body.meta.offset).toBe(10);

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastTwo = params.slice(-2);
    expect(lastTwo).toEqual([5, 10]);
  });

  // 11. Items limit enforced at max 100
  it('11. Items limit is capped at MAX_LIMIT = 100', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 0 }]);

    await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?limit=99999`,
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    const lastTwo = params.slice(-2);
    expect(lastTwo[0]).toBe(100);
  });

  // 12. Markers endpoint returns only marker_ready Point rows
  it('12. GET /news/markers returns only marker-ready Point items', async () => {
    vi.mocked(query).mockResolvedValueOnce([{
      item_id: 'gdacs_point_001',
      title: 'Tropical Cyclone Warning - Pacific',
      source_id: 'gdacs',
      source_url: 'https://www.gdacs.org/report.aspx?eventid=12345',
      latitude: -18.0,
      longitude: 178.0,
      country_code: 'FJI',
      country_name: 'Fiji',
      category: 'Storm',
      subcategory: 'Tropical Cyclone',
      severity: 'red',
      published_at: new Date('2026-06-10T12:00:00Z'),
      source_updated_at: new Date('2026-06-10T13:00:00Z'),
      marker_ready: true,
      attribution: 'GDACS - Global Disaster Alert and Coordination System',
    }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.count).toBe(1);
    expect(body.meta.layer_id).toBe(LAYER_ID);

    const marker = body.data[0];
    expect(marker.item_id).toBe('gdacs_point_001');
    expect(marker.latitude).toBe(-18.0);
    expect(marker.longitude).toBe(178.0);
    expect(marker.marker_ready).toBe(true);
  });

  // 13. Markers SQL enforces marker_ready = TRUE AND geom IS NOT NULL
  it('13. Markers SQL enforces marker_ready = TRUE AND geom IS NOT NULL', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers`,
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('marker_ready = TRUE');
    expect(sql).toContain('geom IS NOT NULL');
  });

  // 14. Markers excludes LineString/Polygon rows (verified by mock shape)
  it('14. Markers returns only Point rows, no LineString/Polygon', async () => {
    vi.mocked(query).mockResolvedValueOnce([{
      item_id: 'gdacs_point_001',
      title: 'Tropical Cyclone Warning - Pacific',
      source_id: 'gdacs',
      source_url: 'https://www.gdacs.org/report.aspx?eventid=12345',
      latitude: -18.0,
      longitude: 178.0,
      country_code: 'FJI',
      country_name: 'Fiji',
      category: 'Storm',
      subcategory: 'Tropical Cyclone',
      severity: 'red',
      published_at: new Date('2026-06-10T12:00:00Z'),
      source_updated_at: new Date('2026-06-10T13:00:00Z'),
      marker_ready: true,
      attribution: 'GDACS - Global Disaster Alert and Coordination System',
    }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    for (const item of body.data) {
      expect(item.latitude).toBeTypeOf('number');
      expect(item.longitude).toBeTypeOf('number');
      expect(item.marker_ready).toBe(true);
    }
  });

  // 15. Markers excludes rows with geom null (SQL enforced)
  it('15. Markers SQL excludes geom-null rows', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers`,
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('geom IS NOT NULL');
  });

  // 16. Sources endpoint returns GDACS seed
  it('16. GET /news/sources returns news sources', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_SOURCE]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/sources`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.count).toBe(1);
    expect(body.meta.layer_id).toBe(LAYER_ID);

    const source = body.data[0];
    expect(source.source_id).toBe('gdacs');
    expect(source.source_family).toBe('disaster_alert');
    expect(source.display_name).toBe('GDACS');
    expect(source.endpoint_url).toBe('https://www.gdacs.org/');
    expect(source.auth_type).toBe('none');
    expect(source.attribution).toContain('GDACS');
    expect(source.license).toBe('CC BY 4.0');
    expect(source.enabled).toBe(true);
  });

  // 17. Sources endpoint does not expose auth_env_var
  it('17. Sources endpoint does not expose auth_env_var', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_SOURCE]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/sources`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('auth_env_var');
  });

  // 18. Fetch-runs endpoint returns run counts
  it('18. GET /news/fetch-runs returns fetch runs', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUN]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/fetch-runs`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.count).toBe(1);

    const run = body.data[0];
    expect(run.fetch_run_id).toBe('run_gdacs_20260610T120000Z');
    expect(run.source_id).toBe('gdacs');
    expect(run.source_family).toBe('disaster_alert');
    expect(run.run_type).toBe('ingestion');
    expect(run.status).toBe('success');
    expect(run.fetched_item_count).toBe(171);
    expect(run.normalized_item_count).toBe(171);
    expect(run.marker_ready_count).toBe(47);
    expect(run.skipped_item_count).toBe(0);
    expect(run.started_at).toBeTypeOf('string');
    expect(run.completed_at).toBeTypeOf('string');
    expect(run.created_at).toBeTypeOf('string');
  });

  // 19. Fetch-runs does not expose raw_output_uri / normalized_output_uri
  it('19. Fetch-runs does not expose raw_output_uri or normalized_output_uri', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUN]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/fetch-runs`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('raw_output_uri');
    expect(bodyStr).not.toContain('normalized_output_uri');
  });

  // 20. Stats endpoint returns correct aggregate counts
  it('20. GET /news/stats returns aggregate counts', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ count: 3 }]);  // total_items
    vi.mocked(query).mockResolvedValueOnce([{ count: 1 }]);  // marker_ready_items
    vi.mocked(query).mockResolvedValueOnce([{ count: 1 }]);  // items_with_geom
    vi.mocked(query).mockResolvedValueOnce([{ source_id: 'gdacs', count: 3 }]);  // by_source
    vi.mocked(query).mockResolvedValueOnce([{ category: 'Storm', count: 1 }, { category: 'Earthquake', count: 1 }, { category: 'Flood', count: 1 }]);  // by_category
    vi.mocked(query).mockResolvedValueOnce([{ subcategory: 'Tropical Cyclone', count: 1 }, { subcategory: 'Tectonic', count: 1 }, { subcategory: 'Riverine', count: 1 }]);  // by_subcategory
    vi.mocked(query).mockResolvedValueOnce([{ severity: 'red', count: 2 }, { severity: 'orange', count: 1 }]);  // by_severity
    vi.mocked(query).mockResolvedValueOnce([{ geometry_type: 'Point', count: 1 }, { geometry_type: 'LineString', count: 1 }, { geometry_type: 'Polygon', count: 1 }]);  // by_geometry_type
    vi.mocked(query).mockResolvedValueOnce([{ fetch_run_id: 'run_gdacs_20260610T120000Z' }]);  // latest_fetch_run
    vi.mocked(query).mockResolvedValueOnce([{ count: 0 }]);  // fake_coordinate_risk_count

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/stats`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.layer_id).toBe(LAYER_ID);
    expect(body.total_items).toBe(3);
    expect(body.marker_ready_items).toBe(1);
    expect(body.items_with_geom).toBe(1);
    expect(body.by_source).toHaveLength(1);
    expect(body.by_source[0].source_id).toBe('gdacs');
    expect(body.by_category).toHaveLength(3);
    expect(body.by_severity).toHaveLength(2);
    expect(body.by_geometry_type).toHaveLength(3);
    expect(body.latest_fetch_run).toBe('run_gdacs_20260610T120000Z');
    expect(body.fake_coordinate_risk_count).toBe(0);
  });

  // 21. Fake coordinate risk count is 0 for safe fixture
  it('21. Stats fake_coordinate_risk_count is 0 for safe fixture', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ count: 3 }]);
    vi.mocked(query).mockResolvedValueOnce([{ count: 1 }]);
    vi.mocked(query).mockResolvedValueOnce([{ count: 1 }]);
    vi.mocked(query).mockResolvedValueOnce([{ source_id: 'gdacs', count: 3 }]);
    vi.mocked(query).mockResolvedValueOnce([{ category: 'Storm', count: 1 }]);
    vi.mocked(query).mockResolvedValueOnce([{ subcategory: 'Tropical Cyclone', count: 1 }]);
    vi.mocked(query).mockResolvedValueOnce([{ severity: 'red', count: 3 }]);
    vi.mocked(query).mockResolvedValueOnce([{ geometry_type: 'Point', count: 1 }]);
    vi.mocked(query).mockResolvedValueOnce([{ fetch_run_id: 'run_gdacs_test' }]);
    vi.mocked(query).mockResolvedValueOnce([{ count: 0 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/stats`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.fake_coordinate_risk_count).toBe(0);
  });

  // 22. Invalid limit returns validation error
  it('22. Invalid limit returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?limit=abc`,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  // 23. Invalid date returns validation error
  it('23. Invalid published_after returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?published_after=not-a-date`,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 24. Invalid offset returns validation error
  it('24. Invalid offset returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?offset=-1`,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 25. No provider_metadata exposed in public response
  it('25. No provider_metadata exposed in items response', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('provider_metadata');
    expect(bodyStr).not.toContain('raw_evidence');
  });

  // 26. No raw source JSON exposed
  it('26. No raw source JSON exposed in responses', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('provider_metadata');
  });

  // 27. No frontend/scheduler/source scope leaks
  it('27. No frontend imports in news route', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync('src/routes/news/index.ts', 'utf-8');
    expect(source).not.toContain('frontend');
    expect(source).not.toContain('components');
    expect(source).not.toContain('React');
    expect(source).not.toContain('jsx');
  });

  // 28. No secrets exposed
  it('28. No secrets exposed in responses', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('secret');
    expect(bodyStr).not.toContain('api_key');
    expect(bodyStr).not.toContain('token');
  });

  // 29. Markers endpoint supports source_id filter
  it('29. Markers endpoint supports source_id filter', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers?source_id=gdacs`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id');
  });

  // 30. Markers endpoint supports category filter
  it('30. Markers endpoint supports category filter', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers?category=Storm`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('category');
  });

  // 31. Markers limit capped at 500
  it('31. Markers limit is capped at MAX_MARKER_LIMIT = 500', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers?limit=9999`,
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const params = callArgs[1] as unknown[];
    expect(params).toContain(500);
  });

  // 32. Empty result returns 200 with empty data
  it('32. Empty items returns 200 with empty data array', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 0 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.meta.count).toBe(0);
  });

  // 33. Internal error on DB failure
  it('33. Returns safe internal error on DB failure', async () => {
    vi.mocked(query).mockRejectedValue(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('SELECT');
    expect(body.error.message).not.toContain('connection');
  });

  // 34. SQL uses parameterized queries
  it('34. SQL uses parameterized queries', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    const params = callArgs[1] as unknown[];
    expect(sql).toContain('$1');
    expect(params).toBeDefined();
    expect(params.length).toBeGreaterThanOrEqual(1);
  });

  // 35. Items order param works
  it('35. Items order param asc/desc', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?order=asc`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('ASC');
  });

  // 36. Invalid order returns 400
  it('36. Invalid order returns 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?order=invalid`,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 37. Fetch runs supports source_id filter
  it('37. Fetch runs supports source_id filter', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUN]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/fetch-runs?source_id=gdacs`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id');
  });

  // 38. Fetch runs supports status filter
  it('38. Fetch runs supports status filter', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUN]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/fetch-runs?status=success`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('status');
  });

  // 39. Fetch runs validates status
  it('39. Fetch runs rejects invalid status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/fetch-runs?status=invalid`,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // 40. Items has_coordinates filter
  it('40. Items filters by has_coordinates', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?has_coordinates=true`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('has_coordinates');
  });

  // 41. Items geometry_type filter
  it('41. Items filters by geometry_type', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?geometry_type=Point`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('geometry_type');
  });

  // 42. Items published_after/published_before range
  it('42. Items filters by published_after and published_before', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?published_after=2026-06-01T00:00:00Z&published_before=2026-06-30T00:00:00Z`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('>=');
    expect(sql).toContain('<=');
  });

  // 43. published_after before published_before validation
  it('43. Rejects published_after after published_before', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?published_after=2026-07-01T00:00:00Z&published_before=2026-06-01T00:00:00Z`,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  // ==================== GDELT Event Export Tests ====================

  const GDELT_SOURCE_ID = 'gdelt_event_export';
  const GDELT_SOURCE_FAMILY = 'global_event';

const MOCK_GDELT_MARKER = {
  item_id: 'gdelt_marker_001',
  layer_id: LAYER_ID,
  source_id: GDELT_SOURCE_ID,
  source_family: GDELT_SOURCE_FAMILY,
  source_object_id: '100000001',
  source_url: 'https://example.com/article1',
  title: 'Diplomatic Meeting Between US and China',
  summary: 'High-level diplomatic negotiations between United States and China.',
  content_type: 'event',
  published_at: new Date('2026-06-13T10:00:00Z'),
  source_updated_at: new Date('2026-06-13T10:30:00Z'),
  fetched_at: new Date('2026-06-13T10:15:00Z'),
  first_seen_at: new Date('2026-06-13T10:15:00Z'),
  last_seen_at: new Date('2026-06-13T10:15:00Z'),
  location_confidence: 'high',
  country_code: 'US',
  country_name: 'United States',
  region: null,
  city: null,
  latitude: 38.9072,
  longitude: -77.0369,
  geometry_type: 'Point',
  geo_source: 'provided',
  has_coordinates: true,
  marker_ready: true,
  category: 'diplomacy',
  subcategory: 'Make Statement',
  severity: 'medium',
  source_domain: 'example.com',
  source_language: null,
  source_country: null,
  confidence_score: null,
  attribution: 'GDELT - Global Database of Events, Language, and Tone',
  is_active: true,
};

const MOCK_GDELT_LIST_ONLY = {
  item_id: 'gdelt_list_001',
  layer_id: LAYER_ID,
  source_id: GDELT_SOURCE_ID,
  source_family: GDELT_SOURCE_FAMILY,
  source_object_id: '100000002',
  source_url: 'https://example.com/article2',
  title: 'Economic Cooperation Agreement Signed',
  summary: 'Countries agree to new trade partnership terms.',
  content_type: 'event',
  published_at: new Date('2026-06-12T08:00:00Z'),
  source_updated_at: new Date('2026-06-12T09:00:00Z'),
  fetched_at: new Date('2026-06-12T08:30:00Z'),
  first_seen_at: new Date('2026-06-12T08:30:00Z'),
  last_seen_at: new Date('2026-06-12T08:30:00Z'),
  location_confidence: 'unknown',
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
  category: 'cooperation',
  subcategory: 'Engage in Diplomatic Cooperation',
  severity: 'low',
  source_domain: 'example.com',
  source_language: null,
  source_country: null,
  confidence_score: null,
  attribution: 'GDELT - Global Database of Events, Language, and Tone',
  is_active: true,
};

const MOCK_GDELT_CONFLICT = {
  item_id: 'gdelt_conflict_001',
  layer_id: LAYER_ID,
  source_id: GDELT_SOURCE_ID,
  source_family: GDELT_SOURCE_FAMILY,
  source_object_id: '100000003',
  source_url: 'https://example.com/article3',
  title: 'Armed Conflict Reported in Border Region',
  summary: 'Military engagement between opposing forces near disputed territory.',
  content_type: 'event',
  published_at: new Date('2026-06-11T06:00:00Z'),
  source_updated_at: new Date('2026-06-11T07:00:00Z'),
  fetched_at: new Date('2026-06-11T06:30:00Z'),
  first_seen_at: new Date('2026-06-11T06:30:00Z'),
  last_seen_at: new Date('2026-06-11T06:30:00Z'),
  location_confidence: 'medium',
  country_code: 'UA',
  country_name: 'Ukraine',
  region: null,
  city: null,
  latitude: 48.3794,
  longitude: 31.1656,
  geometry_type: 'Point',
  geo_source: 'provided',
  has_coordinates: true,
  marker_ready: true,
  category: 'conflict',
  subcategory: 'Use Conventional Military Force',
  severity: 'high',
  source_domain: 'example.com',
  source_language: null,
  source_country: null,
  confidence_score: null,
  attribution: 'GDELT - Global Database of Events, Language, and Tone',
  is_active: true,
};

const MOCK_GDELT_SOURCE = {
  source_id: GDELT_SOURCE_ID,
  layer_id: LAYER_ID,
  source_family: GDELT_SOURCE_FAMILY,
  display_name: 'GDELT Event Export',
  endpoint_url: 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt',
  auth_type: 'none',
  attribution: 'GDELT - Global Database of Events, Language, and Tone (https://www.gdeltproject.org/)',
  license: 'Public dataset terms; source attribution required',
  enabled: true,
  last_fetched_at: new Date('2026-06-13T10:00:00Z'),
  last_error: null,
  update_frequency_minutes: 15,
};

const MOCK_GDELT_FETCH_RUN = {
  fetch_run_id: 'run_gdelt_20260613T100000Z',
  layer_id: LAYER_ID,
  source_id: GDELT_SOURCE_ID,
  source_family: GDELT_SOURCE_FAMILY,
  run_type: 'ingestion',
  status: 'success',
  started_at: new Date('2026-06-13T10:00:00Z'),
  completed_at: new Date('2026-06-13T10:05:00Z'),
  fetched_item_count: 504,
  normalized_item_count: 504,
  marker_ready_count: 350,
  skipped_item_count: 0,
  error_message: null,
  created_at: new Date('2026-06-13T10:05:00Z'),
};

  // 1. Items endpoint returns GDELT records
  it('44. Items endpoint returns GDELT event records', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_MARKER, MOCK_GDELT_LIST_ONLY, MOCK_GDELT_CONFLICT]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 3 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.count).toBe(3);
    expect(body.meta.layer_id).toBe(LAYER_ID);
  });

  // 2. Items endpoint source_id=gdelt_event_export filter
  it('45. Items filters by source_id=gdelt_event_export', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_MARKER, MOCK_GDELT_LIST_ONLY]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 2 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=${GDELT_SOURCE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id');
    const params = callArgs[1] as unknown[];
    expect(params).toContain(GDELT_SOURCE_ID);
  });

  // 3. Items endpoint marker_ready=false returns list-only GDELT rows
  it('46. Items with marker_ready=false returns list-only GDELT rows', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_LIST_ONLY]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=${GDELT_SOURCE_ID}&marker_ready=false`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].source_id).toBe(GDELT_SOURCE_ID);
    expect(body.data[0].location.marker_ready).toBe(false);
    expect(body.data[0].location.latitude).toBeNull();
    expect(body.data[0].location.longitude).toBeNull();
    expect(body.data[0].location.has_coordinates).toBe(false);
  });

  // 4. Items endpoint returns GDELT diplomacy/cooperation/conflict categories
  it('47. Items endpoint returns GDELT with correct category values', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_MARKER]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=${GDELT_SOURCE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];
    expect(item.category).toBe('diplomacy');
    expect(item.subcategory).toBe('Make Statement');
    expect(item.severity).toBe('medium');
    expect(item.location.confidence).toBe('high');
  });

  // 5. Items endpoint does not expose raw CSV rows
  it('48. Items endpoint does not expose raw CSV fields', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_MARKER, MOCK_GDELT_LIST_ONLY, MOCK_GDELT_CONFLICT]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 3 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=${GDELT_SOURCE_ID}`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('global_event_id');
    expect(bodyStr).not.toContain('ActionGeo_Lat');
    expect(bodyStr).not.toContain('ActionGeo_Long');
    expect(bodyStr).not.toContain('CAMEO');
    expect(bodyStr).not.toContain('QuadClass');
    expect(bodyStr).not.toContain('Actor1Name');
    expect(bodyStr).not.toContain('Actor2Name');
    expect(bodyStr).not.toContain('provider_metadata');
  });

  // 6. Items endpoint supports GDELT severity values
  it('49. Items endpoint honors severity filter for GDELT', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_CONFLICT]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=${GDELT_SOURCE_ID}&severity=high`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('severity');
  });

  // 7. Markers endpoint includes marker-ready GDELT rows
  it('50. Markers endpoint returns marker-ready GDELT rows', async () => {
    vi.mocked(query).mockResolvedValueOnce([{
      item_id: 'gdelt_marker_001',
      title: 'Diplomatic Meeting Between US and China',
      source_id: GDELT_SOURCE_ID,
      source_url: 'https://example.com/article1',
      latitude: 38.9072,
      longitude: -77.0369,
      country_code: 'US',
      country_name: 'United States',
      category: 'diplomacy',
      subcategory: 'Make Statement',
      severity: 'medium',
      published_at: new Date('2026-06-13T10:00:00Z'),
      source_updated_at: new Date('2026-06-13T10:30:00Z'),
      marker_ready: true,
      attribution: 'GDELT - Global Database of Events, Language, and Tone',
    }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers?source_id=${GDELT_SOURCE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].marker_ready).toBe(true);
    expect(body.data[0].latitude).toBe(38.9072);
    expect(body.data[0].longitude).toBe(-77.0369);
    expect(body.data[0].source_id).toBe(GDELT_SOURCE_ID);
  });

  // 8. Markers endpoint excludes list-only rows
  it('51. Markers endpoint excludes GDELT list-only rows', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers?source_id=${GDELT_SOURCE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('marker_ready = TRUE');
    expect(sql).toContain('geom IS NOT NULL');
  });

  // 9. Markers SQL enforces marker_ready AND geom for GDELT
  it('52. Markers SQL enforces marker_ready + geom constraints for GDELT', async () => {
    vi.mocked(query).mockResolvedValueOnce([]);

    await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/markers?source_id=${GDELT_SOURCE_ID}`,
    });

    const callArgs = vi.mocked(query).mock.calls[0];
    const sql = callArgs[0] as string;
    expect(sql).toContain('source_id');
    expect(sql).toContain('marker_ready = TRUE');
    expect(sql).toContain('geom IS NOT NULL');
  });

  // 10. Sources endpoint includes gdelt_event_export
  it('53. Sources endpoint includes gdelt_event_export', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_SOURCE]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/sources`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const sourceIds = body.data.map((s: { source_id: string }) => s.source_id);
    expect(sourceIds).toContain(GDELT_SOURCE_ID);

    const gdeltSource = body.data.find((s: { source_id: string }) => s.source_id === GDELT_SOURCE_ID);
    expect(gdeltSource.source_family).toBe(GDELT_SOURCE_FAMILY);
    expect(gdeltSource.display_name).toBe('GDELT Event Export');
    expect(gdeltSource.auth_type).toBe('none');
    expect(gdeltSource.attribution).toContain('GDELT');
    expect(gdeltSource.license).toContain('Public dataset terms');
    expect(gdeltSource.enabled).toBe(true);
  });

  // 11. Sources endpoint does not expose auth_env_var for GDELT
  it('54. Sources endpoint does not expose auth_env_var for gdelt_event_export', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_SOURCE]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/sources`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('auth_env_var');
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('secret');
    expect(bodyStr).not.toContain('api_key');
  });

  // 12. Fetch-runs endpoint supports GDELT source
  it('55. Fetch-runs endpoint returns GDELT fetch runs', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_FETCH_RUN]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/fetch-runs?source_id=${GDELT_SOURCE_ID}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data[0].source_id).toBe(GDELT_SOURCE_ID);
    expect(body.data[0].source_family).toBe(GDELT_SOURCE_FAMILY);
    expect(body.data[0].fetch_run_id).toBe('run_gdelt_20260613T100000Z');
    expect(body.data[0].fetched_item_count).toBe(504);
    expect(body.data[0].normalized_item_count).toBe(504);
    expect(body.data[0].marker_ready_count).toBe(350);
    expect(body.data[0].status).toBe('success');
  });

  // 13. Fetch-runs does not expose raw_output_uri for GDELT
  it('56. Fetch-runs does not expose raw_output_uri for GDELT', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_FETCH_RUN]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/fetch-runs?source_id=${GDELT_SOURCE_ID}`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('raw_output_uri');
    expect(bodyStr).not.toContain('normalized_output_uri');
  });

  // 14. Stats endpoint includes GDELT counts
  it('57. Stats endpoint includes GDELT source counts', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ count: 504 }]);  // total_items
    vi.mocked(query).mockResolvedValueOnce([{ count: 350 }]);  // marker_ready_items
    vi.mocked(query).mockResolvedValueOnce([{ count: 350 }]);  // items_with_geom
    vi.mocked(query).mockResolvedValueOnce([{ source_id: GDELT_SOURCE_ID, count: 504 }, { source_id: 'gdacs', count: 171 }]);  // by_source
    vi.mocked(query).mockResolvedValueOnce([{ category: 'diplomacy', count: 200 }, { category: 'cooperation', count: 150 }, { category: 'conflict', count: 154 }]);  // by_category
    vi.mocked(query).mockResolvedValueOnce([{ subcategory: 'Make Statement', count: 100 }, { subcategory: 'Use Conventional Military Force', count: 80 }]);  // by_subcategory
    vi.mocked(query).mockResolvedValueOnce([{ severity: 'low', count: 150 }, { severity: 'medium', count: 200 }, { severity: 'high', count: 100 }, { severity: 'unknown', count: 54 }]);  // by_severity
    vi.mocked(query).mockResolvedValueOnce([{ geometry_type: 'Point', count: 350 }, { geometry_type: 'none', count: 154 }]);  // by_geometry_type
    vi.mocked(query).mockResolvedValueOnce([{ fetch_run_id: 'run_gdelt_20260613T100000Z' }]);  // latest_fetch_run
    vi.mocked(query).mockResolvedValueOnce([{ count: 0 }]);  // fake_coordinate_risk_count

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/stats`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.layer_id).toBe(LAYER_ID);
    expect(body.total_items).toBe(504);
    expect(body.marker_ready_items).toBe(350);
    expect(body.items_with_geom).toBe(350);

    const gdeltSource = body.by_source.find((s: { source_id: string }) => s.source_id === GDELT_SOURCE_ID);
    expect(gdeltSource).toBeDefined();
    expect(gdeltSource.count).toBe(504);

    const diplomacyCat = body.by_category.find((c: { category: string }) => c.category === 'diplomacy');
    expect(diplomacyCat).toBeDefined();
    expect(diplomacyCat.count).toBe(200);

    expect(body.fake_coordinate_risk_count).toBe(0);
  });

  // 15. Stats endpoint fake_coordinate_risk_count = 0 for clean GDELT data
  it('58. Stats fake_coordinate_risk_count is 0 for GDELT data', async () => {
    vi.mocked(query).mockResolvedValueOnce([{ count: 504 }]);
    vi.mocked(query).mockResolvedValueOnce([{ count: 350 }]);
    vi.mocked(query).mockResolvedValueOnce([{ count: 350 }]);
    vi.mocked(query).mockResolvedValueOnce([{ source_id: GDELT_SOURCE_ID, count: 504 }]);
    vi.mocked(query).mockResolvedValueOnce([{ category: 'diplomacy', count: 200 }]);
    vi.mocked(query).mockResolvedValueOnce([{ subcategory: 'Make Statement', count: 100 }]);
    vi.mocked(query).mockResolvedValueOnce([{ severity: 'medium', count: 504 }]);
    vi.mocked(query).mockResolvedValueOnce([{ geometry_type: 'Point', count: 350 }]);
    vi.mocked(query).mockResolvedValueOnce([{ fetch_run_id: 'run_gdelt_test' }]);
    vi.mocked(query).mockResolvedValueOnce([{ count: 0 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/stats`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.fake_coordinate_risk_count).toBe(0);
  });

  // 16. No raw source JSON or provider_metadata exposed for GDELT
  it('59. No provider_metadata or raw evidence exposed for GDELT', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_MARKER]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=${GDELT_SOURCE_ID}`,
    });

    const bodyStr = JSON.stringify(response.body);
    expect(bodyStr).not.toContain('provider_metadata');
    expect(bodyStr).not.toContain('raw_evidence');
  });

  // 17. No fake coordinates for GDELT list-only items
  it('60. GDELT list-only items have null coordinates (no fake coords)', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_GDELT_LIST_ONLY]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items?source_id=${GDELT_SOURCE_ID}&marker_ready=false`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const item = body.data[0];
    expect(item.location.latitude).toBeNull();
    expect(item.location.longitude).toBeNull();
    expect(item.location.has_coordinates).toBe(false);
    expect(item.location.marker_ready).toBe(false);
  });

  // ===================================================================
  // Clean public slug aliases (API-URL-001 / API-POLICY-001)
  // Each new path returns the same response shape as the legacy
  // /api/layers/layer_08_news_osint/news/... path. The old paths are
  // preserved and continue to work; the new paths are aliases only.
  // ===================================================================

  it('alias.1 GET /api/layers/news/items returns news items with the same shape as the legacy path', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);

    const newPathResponse = await app.inject({
      method: 'GET',
      url: '/api/layers/news/items',
    });
    expect(newPathResponse.statusCode).toBe(200);
    const newPathBody = JSON.parse(newPathResponse.body);

    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);
    vi.mocked(query).mockResolvedValueOnce([{ total: 1 }]);
    const legacyResponse = await app.inject({
      method: 'GET',
      url: `/api/layers/${LAYER_ID}/news/items`,
    });
    expect(legacyResponse.statusCode).toBe(200);
    const legacyBody = JSON.parse(legacyResponse.body);

    expect(Object.keys(newPathBody).sort()).toEqual(Object.keys(legacyBody).sort());
    expect(newPathBody.meta.layer_id).toBe(LAYER_ID);
    expect(legacyBody.meta.layer_id).toBe(LAYER_ID);
  });

  it('alias.2 GET /api/layers/news/markers returns news markers', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_POINT_ITEM]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/news/markers',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.layer_id).toBe(LAYER_ID);
  });

  it('alias.3 GET /api/layers/news/sources returns sources list', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_SOURCE]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/news/sources',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.layer_id).toBe(LAYER_ID);
    expect(body.meta.count).toBe(1);
  });

  it('alias.4 GET /api/layers/news/fetch-runs returns fetch runs list', async () => {
    vi.mocked(query).mockResolvedValueOnce([MOCK_FETCH_RUN]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/news/fetch-runs',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.meta.layer_id).toBe(LAYER_ID);
    expect(body.meta.count).toBe(1);
  });

  it('alias.5 GET /api/layers/news/stats returns stats object', async () => {
    // Match the existing test 20 mock shape so the Zod parse succeeds.
    vi.mocked(query).mockResolvedValueOnce([{ count: 3 }]);  // total_items
    vi.mocked(query).mockResolvedValueOnce([{ count: 1 }]);  // marker_ready_items
    vi.mocked(query).mockResolvedValueOnce([{ count: 1 }]);  // items_with_geom
    vi.mocked(query).mockResolvedValueOnce([{ source_id: 'gdacs', count: 3 }]);  // by_source
    vi.mocked(query).mockResolvedValueOnce([{ category: 'Storm', count: 1 }, { category: 'Earthquake', count: 1 }, { category: 'Flood', count: 1 }]);  // by_category
    vi.mocked(query).mockResolvedValueOnce([{ subcategory: 'Tropical Cyclone', count: 1 }, { subcategory: 'Tectonic', count: 1 }, { subcategory: 'Riverine', count: 1 }]);  // by_subcategory
    vi.mocked(query).mockResolvedValueOnce([{ severity: 'red', count: 2 }, { severity: 'orange', count: 1 }]);  // by_severity
    vi.mocked(query).mockResolvedValueOnce([{ geometry_type: 'Point', count: 1 }, { geometry_type: 'LineString', count: 1 }, { geometry_type: 'Polygon', count: 1 }]);  // by_geometry_type
    vi.mocked(query).mockResolvedValueOnce([{ fetch_run_id: 'run_gdacs_20260610T120000Z' }]);  // latest_fetch_run
    vi.mocked(query).mockResolvedValueOnce([{ count: 0 }]);  // fake_coordinate_risk_count

    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/news/stats',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.layer_id).toBe(LAYER_ID);
    expect(body.total_items).toBe(3);
  });

  it('alias.6 The new clean News path does not create a duplicated /api/layers/news/news/... path', async () => {
    // Negative test: a duplicated /api/layers/news/news/<verb> path must
    // NOT exist (would 404). This guards the slug rule from accidental
    // duplication if a future agent re-introduces the `${LAYER_ID}/news/`
    // segment under the new slug.
    const response = await app.inject({
      method: 'GET',
      url: '/api/layers/news/news/items',
    });
    expect(response.statusCode).toBe(404);
  });
});
