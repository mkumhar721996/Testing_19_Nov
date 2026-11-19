import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { AuditLog } from '../audit/audit.js';
import { principalOf, requireRole } from '../auth/auth.js';
import type { OfferingRepository } from '../offerings/repository.js';
import { DuplicateNameError, type ServiceTypeRepository, type ServiceTypeRow } from './repository.js';
import { parseName } from './validation.js';

const NAME_ERROR = 'Enter a service type name of 1 to 80 characters';
const DUPLICATE_ERROR = 'A service type with this name already exists. Enter a different name';

const present = (t: ServiceTypeRow, providersStillOffering = 0) => ({
  id: t.id,
  name: t.name,
  status: t.retiredAt ? 'retired' : 'offered',
  providersStillOffering,
});

export const serviceTypeRoutes = (
  repo: ServiceTypeRepository,
  offerings: OfferingRepository,
  audit: AuditLog,
): FastifyPluginAsync =>
  async (app) => {
    const admin = requireRole('admin');
    const entity = 'service_type';

    const duplicate = (reply: FastifyReply, err: unknown) => {
      if (err instanceof DuplicateNameError) return reply.code(409).send({ error: DUPLICATE_ERROR });
      throw err;
    };

    app.get('/admin/service-types', { preHandler: admin }, async () => {
      const [rows, counts] = await Promise.all([repo.listAll(), offerings.providerCounts()]);
      return rows.map((t) => present(t, counts[t.id] ?? 0));
    });

    app.post('/admin/service-types', { preHandler: admin }, async (request, reply) => {
      const name = parseName(request.body);
      if (!name) return reply.code(400).send({ error: NAME_ERROR });
      try {
        const created = await repo.create(name);
        await audit.record({ actorId: principalOf(request).id, action: 'service_type.created', entity, entityId: created.id, detail: { name } });
        return reply.code(201).send(present(created));
      } catch (err) {
        return duplicate(reply, err);
      }
    });

    app.patch<{ Params: { id: string } }>('/admin/service-types/:id', { preHandler: admin }, async (request, reply) => {
      const name = parseName(request.body);
      if (!name) return reply.code(400).send({ error: NAME_ERROR });
      try {
        const renamed = await repo.rename(request.params.id, name);
        if (!renamed) return reply.code(404).send({ error: 'Service type not found' });
        await audit.record({ actorId: principalOf(request).id, action: 'service_type.renamed', entity, entityId: renamed.id, detail: { name } });
        return present(renamed);
      } catch (err) {
        return duplicate(reply, err);
      }
    });

    app.post<{ Params: { id: string } }>('/admin/service-types/:id/retire', { preHandler: admin }, async (request, reply) => {
      const retired = await repo.retire(request.params.id);
      if (!retired) return reply.code(404).send({ error: 'Service type not found' });
      await audit.record({ actorId: principalOf(request).id, action: 'service_type.retired', entity, entityId: retired.id });
      return present(retired);
    });

    // The list providers choose from: retired types are left out.
    app.get('/service-types', async () => (await repo.listOffered()).map((t) => ({ id: t.id, name: t.name })));
  };
