import type { FastifyPluginAsync } from 'fastify';
import { principalOf, requireRole } from '../auth/auth.js';
import type { OfferingRepository } from './repository.js';

export const offeringsRoutes = (offerings: OfferingRepository): FastifyPluginAsync =>
  async (app) => {
    app.get('/provider/offerings', { preHandler: requireRole('provider') }, async (request) =>
      offerings.listForProvider(principalOf(request).id),
    );
  };
