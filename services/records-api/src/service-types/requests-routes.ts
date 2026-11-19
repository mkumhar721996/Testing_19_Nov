import type { FastifyPluginAsync } from 'fastify';
import type { AuditLog } from '../audit/audit.js';
import { principalOf, requireRole } from '../auth/auth.js';
import type { ServiceTypeRequestRepository } from './repository.js';
import { parseName } from './validation.js';

export const requestsRoutes = (requests: ServiceTypeRequestRepository, audit: AuditLog): FastifyPluginAsync =>
  async (app) => {
    app.post('/service-type-requests', { preHandler: requireRole('provider') }, async (request, reply) => {
      const name = parseName(request.body);
      if (!name) return reply.code(400).send({ error: 'Enter the service type you need' });
      const providerId = principalOf(request).id;
      const row = await requests.add(providerId, name);
      await audit.record({ actorId: providerId, action: 'service_type_request.created', entity: 'service_type_request', entityId: row.id, detail: { name } });
      return reply.code(201).send({ requested: true });
    });
  };
