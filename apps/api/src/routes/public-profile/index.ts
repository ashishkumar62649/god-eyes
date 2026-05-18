// Public profile route handler

import { FastifyInstance, FastifyReply } from 'fastify';
import { checkDatabaseStatus } from '../../lib/db.js';
import { handlePublicProfile } from './service.js';
import { PublicProfileResponse, PublicProfileStatus } from './types.js';

interface PublicProfileParams {
  airportId: string;
}

// Helper to send error response with status code
function sendError(reply: FastifyReply, statusCode: number, body: PublicProfileResponse) {
  reply.code(statusCode);
  return body;
}

function getStatusCode(status: PublicProfileStatus): number {
  switch (status) {
    case 'ok':
    case 'stale':
      return 200;
    case 'fetching':
      return 202; // Accepted - profile is being fetched
    case 'no_profile_found':
      return 404;
    case 'low_confidence_match':
      return 200;
    case 'error':
      return 500;
    default:
      return 500;
  }
}

export async function publicProfileRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: PublicProfileParams;
  }>('/api/airports/:airportId/public-profile', async (request, reply) => {
    const { airportId } = request.params;

    // Validate airportId
    if (!airportId || airportId.trim() === '') {
      return sendError(reply, 400, {
        status: 'error',
        cached: false,
        profile: null,
        fetchedAt: null,
        expiresAt: null,
        attribution: null,
      });
    }

    // Check database availability
    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.status === 'offline') {
      return sendError(reply, 503, {
        status: 'error',
        cached: false,
        profile: null,
        fetchedAt: null,
        expiresAt: null,
        attribution: null,
      });
    }

    try {
      const result = await handlePublicProfile(airportId);
      const statusCode = getStatusCode(result.status);
      return sendError(reply, statusCode, result);
    } catch (error) {
      return sendError(reply, 500, {
        status: 'error',
        cached: false,
        profile: null,
        fetchedAt: null,
        expiresAt: null,
        attribution: null,
      });
    }
  });
}
