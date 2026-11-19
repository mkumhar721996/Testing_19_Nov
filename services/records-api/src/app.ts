import Fastify, { type FastifyInstance } from 'fastify';
import { authRoutes, type AuthDeps } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';

export function buildApp(deps?: AuthDeps): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(healthRoutes);
  if (deps) app.register(authRoutes(deps));
  return app;
}
