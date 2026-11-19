import Fastify, { type FastifyInstance } from 'fastify';
import { createProfileStore } from './profiles/store.js';
import type { ProfileStore } from './profiles/types.js';
import { healthRoutes } from './routes/health.js';
import { profileRoutes } from './routes/profiles.js';

export function buildApp(deps: { store?: ProfileStore } = {}): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(healthRoutes);
  app.register(profileRoutes, { store: deps.store ?? createProfileStore() });
  return app;
}
