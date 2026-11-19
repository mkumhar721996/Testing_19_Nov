import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { MemoryAuditLog, PgAuditLog, type AuditLog } from './audit/audit.js';
import { authenticate, type TokenVerifier } from './auth/auth.js';
import { createEntraVerifier, testVerifier } from './auth/entra-verifier.js';
import { createPool } from './db/pool.js';
import { offeringsRoutes } from './offerings/offerings-routes.js';
import { MemoryOfferingRepository } from './offerings/memory-repository.js';
import { PgOfferingRepository } from './offerings/pg-repository.js';
import type { OfferingRepository } from './offerings/repository.js';
import { healthRoutes } from './routes/health.js';
import { MemoryServiceTypeRepository } from './service-types/memory-repository.js';
import { MemoryRequestRepository } from './service-types/memory-requests-repository.js';
import { PgRequestRepository, PgServiceTypeRepository } from './service-types/pg-repository.js';
import type { ServiceTypeRepository, ServiceTypeRequestRepository } from './service-types/repository.js';
import { requestsRoutes } from './service-types/requests-routes.js';
import { serviceTypeRoutes } from './service-types/routes.js';

export interface AppDeps {
  verifier: TokenVerifier;
  serviceTypes: ServiceTypeRepository;
  requests: ServiceTypeRequestRepository;
  offerings: OfferingRepository;
  audit: AuditLog;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function defaultDeps(): AppDeps {
  const isTest = process.env.NODE_ENV === 'test';
  const verifier = isTest ? testVerifier : createEntraVerifier(required('ENTRA_TENANT_ID'), required('ENTRA_AUDIENCE'));
  if (isTest && !process.env.DATABASE_URL) {
    const serviceTypes = new MemoryServiceTypeRepository();
    return { verifier, serviceTypes, requests: new MemoryRequestRepository(), offerings: new MemoryOfferingRepository(serviceTypes), audit: new MemoryAuditLog() };
  }
  const pool = createPool();
  return {
    verifier,
    serviceTypes: new PgServiceTypeRepository(pool),
    requests: new PgRequestRepository(pool),
    offerings: new PgOfferingRepository(pool),
    audit: new PgAuditLog(pool),
  };
}

export function buildApp(deps: AppDeps = defaultDeps()): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  const origin = process.env.CORS_ORIGIN;
  app.register(cors, { origin: origin ? origin.split(',') : false, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'] });
  app.register(healthRoutes);
  app.register(async (secured) => {
    secured.addHook('preHandler', authenticate(deps.verifier));
    secured.register(serviceTypeRoutes(deps.serviceTypes, deps.offerings, deps.audit));
    secured.register(requestsRoutes(deps.requests, deps.audit));
    secured.register(offeringsRoutes(deps.offerings));
  });
  return app;
}
