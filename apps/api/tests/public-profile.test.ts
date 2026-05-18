import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { publicProfileRoutes } from '../src/routes/public-profile/index.js';

// Mock the repository module
vi.mock('../src/routes/public-profile/repository.js', () => ({
  getCachedProfile: vi.fn(),
  getStaleProfile: vi.fn(),
  markStaleAndQueueRefresh: vi.fn(),
  hasInProgressFetch: vi.fn(),
  createFetchRun: vi.fn(),
  saveProfile: vi.fn(),
  saveNoProfileFound: vi.fn(),
  saveLowConfidenceMatch: vi.fn(),
}));

import * as repository from '../src/routes/public-profile/repository.js';

describe('Public Profile API', () => {
  let app: Fastify.FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(publicProfileRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/airports/:airportId/public-profile', () => {
    it('should return 400 for empty airportId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/airports//public-profile',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return ok status for fresh cached profile', async () => {
      vi.mocked(repository.getCachedProfile).mockResolvedValue({
        status: 'ok',
        cached: true,
        profile: {
          id: 'cached-airport',
          name: 'Cached Airport',
          iataCode: 'CCH',
          icaoCode: 'CCHA',
          location: { latitude: 51.47, longitude: -0.46, city: 'London', country: 'GB' },
          summary: 'A cached airport',
          facts: {},
        },
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        attribution: { source: 'OurAirports', matchMethod: 'exact', matchConfidence: 'high' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/cached-airport/public-profile',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.cached).toBe(true);
      expect(body.profile).not.toBeNull();
      expect(body.fetchedAt).toBeDefined();
      expect(body.expiresAt).toBeDefined();
      expect(body.attribution).toBeDefined();
    });

    it('should return stale status for expired cache', async () => {
      const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days ago

      vi.mocked(repository.getCachedProfile).mockResolvedValue(null);
      vi.mocked(repository.getStaleProfile).mockResolvedValue({
        status: 'ok',
        cached: true,
        profile: {
          id: 'stale-airport',
          name: 'Stale Airport',
          iataCode: 'STL',
          icaoCode: 'STLA',
          location: { latitude: 40.64, longitude: -73.78, city: 'New York', country: 'US' },
          summary: 'A stale airport',
          facts: {},
        },
        fetchedAt: staleDate,
        expiresAt: staleDate,
        attribution: { source: 'OurAirports', matchMethod: 'exact', matchConfidence: 'high' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/stale-airport/public-profile',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('stale');
      expect(body.cached).toBe(true);
      expect(repository.markStaleAndQueueRefresh).toHaveBeenCalled();
    });

    it('should return fetching status when no cache and no in-progress fetch', async () => {
      vi.mocked(repository.getCachedProfile).mockResolvedValue(null);
      vi.mocked(repository.getStaleProfile).mockResolvedValue(null);
      vi.mocked(repository.hasInProgressFetch).mockResolvedValue(false);
      vi.mocked(repository.createFetchRun).mockResolvedValue('fetch-run-id');

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/new-airport/public-profile',
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.status).toBe('fetching');
      expect(body.cached).toBe(false);
      expect(body.profile).toBeNull();
      expect(repository.createFetchRun).toHaveBeenCalled();
    });

    it('should return fetching status when fetch is in progress', async () => {
      vi.mocked(repository.getCachedProfile).mockResolvedValue(null);
      vi.mocked(repository.getStaleProfile).mockResolvedValue(null);
      vi.mocked(repository.hasInProgressFetch).mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/fetching-airport/public-profile',
      });

      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.status).toBe('fetching');
    });

    it('should return no_profile_found when sentinel exists', async () => {
      vi.mocked(repository.getCachedProfile).mockResolvedValue({
        status: 'no_profile_found',
        cached: false,
        profile: null,
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        attribution: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/missing-airport/public-profile',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('no_profile_found');
      expect(body.profile).toBeNull();
    });

    it('should return low_confidence_match when confidence is low', async () => {
      vi.mocked(repository.getCachedProfile).mockResolvedValue({
        status: 'low_confidence_match',
        cached: true,
        profile: {
          id: 'uncertain-airport',
          name: 'Uncertain Airport',
          iataCode: null,
          icaoCode: 'UNCERT',
          location: { latitude: null, longitude: null, city: null, country: 'XX' },
          summary: null,
          facts: null,
        },
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        attribution: { source: 'Wikidata', matchMethod: 'fuzzy', matchConfidence: 'low' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/uncertain-airport/public-profile',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('low_confidence_match');
    });

    it('should return error status on internal error', async () => {
      vi.mocked(repository.getCachedProfile).mockRejectedValue(new Error('DB connection failed'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/error-airport/public-profile',
      });

      expect(response.statusCode).toBe(500);
      const body = response.json();
      expect(body.status).toBe('error');
    });
  });
});
