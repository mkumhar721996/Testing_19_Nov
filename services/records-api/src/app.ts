import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { watchlistRoutes, type WatchlistLimits } from './routes/watchlist.js';
import { MemoryWatchlistRepository } from './watchlist/memory-repository.js';
import type { WatchlistRepository } from './watchlist/repository.js';

export function buildApp(
  deps: { watchlist?: WatchlistRepository; watchlistLimits?: WatchlistLimits } = {},
): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(healthRoutes);
  app.register(watchlistRoutes(deps.watchlist ?? new MemoryWatchlistRepository(), deps.watchlistLimits));
  return app;
}
