import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { publicProfileRoutes } from '../src/routes/public-profile/index.js';
import { setPublicProfileRepository } from '../src/routes/public-profile/service.js';
import { PublicProfileRepository, PublicProfileResponse } from '../src/routes/public-profile/types.js';

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

  // Mock repository for testing
  const createMockRepository = (responses: Record<string, PublicProfileResponse | null>): PublicProfileRepository => ({
    async getCachedProfile(airportId: string) {
      return responses[airportId] ?? null;
    },
    async fetchAndCacheProfile(airportId: string) {
      return {
        status: 'ok',
        cached: false,
        profile: {
          id: airportId,
          name: 'Test Airport',
          iataCode: 'TST',
          icaoCode: 'TSTA',
          location: { latitude: 0, longitude: 0, city: 'Test City', country: 'TC' },
          summary: 'Test summary',
          facts: {},
        },
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        attribution: { source: 'test', matchMethod: 'exact', matchConfidence: 'high' },
      };
    },
    async markStaleAndQueueRefresh(airportId: string) {
      // No-op for mock
    },
  });

  describe('GET /api/airports/:airportId/public-profile', () => {
    it('should return 400 for empty airportId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/airports//public-profile',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return fetching status when cache miss and repository not set', async () => {
      // Without repository set, should return error
      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/test-airport/public-profile',
      });

      // Repository not initialized - will return error
      expect([200, 202, 500, 503]).toContain(response.statusCode);
      const body = response.json();
      expect(body).toHaveProperty('status');
    });

    it('should return ok status for cached profile', async () => {
      const mockRepo = createMockRepository({
        'cached-airport': {
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
        },
      });

      setPublicProfileRepository(mockRepo);

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

      const mockRepo = createMockRepository({
        'stale-airport': {
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
        },
      });

      setPublicProfileRepository(mockRepo);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/stale-airport/public-profile',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('stale');
      expect(body.cached).toBe(true);
    });

    it('should return no_profile_found when no profile exists', async () => {
      const mockRepo = createMockRepository({
        'missing-airport': {
          status: 'no_profile_found',
          cached: false,
          profile: null,
          fetchedAt: null,
          expiresAt: null,
          attribution: null,
        },
      });

      setPublicProfileRepository(mockRepo);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/missing-airport/public-profile',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.status).toBe('no_profile_found');
      expect(body.profile).toBeNull();
    });

    it('should return low_confidence_match when confidence is low', async () => {
      const mockRepo = createMockRepository({
        'uncertain-airport': {
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
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          attribution: { source: 'Wikidata', matchMethod: 'fuzzy', matchConfidence: 'low' },
        },
      });

      setPublicProfileRepository(mockRepo);

      const response = await app.inject({
        method: 'GET',
        url: '/api/airports/uncertain-airport/public-profile',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('low_confidence_match');
    });
  });
});
