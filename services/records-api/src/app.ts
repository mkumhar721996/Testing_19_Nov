import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { AvailabilityStore, Principal, ServiceCatalogPort } from './availability/types.js';
import { availabilityRoutes } from './routes/availability.js';
import { healthRoutes } from './routes/health.js';
import { slotsRoutes } from './routes/slots.js';

export interface AppDeps {
  store: AvailabilityStore;
  catalog: ServiceCatalogPort;
  authenticate: (req: FastifyRequest) => Promise<Principal | null>;
}

export function buildApp(deps: Partial<AppDeps> = {}): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(healthRoutes);
  const { store, catalog, authenticate } = deps;
  if (store && authenticate) app.register(availabilityRoutes({ store, authenticate }));
  if (store && catalog) app.register(slotsRoutes({ store, catalog }));
  return app;
}
