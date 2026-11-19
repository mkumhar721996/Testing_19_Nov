import type { FastifyPluginAsync } from 'fastify';
import type { WatchlistRepository } from '../watchlist/repository.js';
import { normalizeSymbol, validateSymbol } from '../watchlist/symbol.js';

export interface WatchlistLimits {
  maxTickers?: number;
  maxPostsPerWindow?: number;
  windowMs?: number;
}

export const watchlistRoutes =
  (repo: WatchlistRepository, limits: WatchlistLimits = {}): FastifyPluginAsync =>
  async (app) => {
    const maxTickers = limits.maxTickers ?? 100;
    const maxPosts = limits.maxPostsPerWindow ?? 30;
    const windowMs = limits.windowMs ?? 60_000;
    const hits = new Map<string, { count: number; resetAt: number }>();

    app.get('/watchlist', async () => ({ tickers: await repo.list() }));

    app.post('/watchlist', async (request, reply) => {
      const now = Date.now();
      for (const [key, w] of hits) if (w.resetAt <= now) hits.delete(key);
      const win = hits.get(request.ip) ?? { count: 0, resetAt: now + windowMs };
      win.count += 1;
      hits.set(request.ip, win);
      if (win.count > maxPosts) {
        return reply
          .code(429)
          .header('Retry-After', Math.ceil((win.resetAt - now) / 1000))
          .send({ error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' } });
      }

      const raw = (request.body as { symbol?: unknown } | null | undefined)?.symbol;
      const symbol = typeof raw === 'string' ? normalizeSymbol(raw) : '';
      if (!validateSymbol(symbol)) {
        return reply.code(400).send({
          error: {
            code: 'invalid_symbol',
            message: 'Enter a ticker symbol of 1 to 5 letters, for example AAPL.',
          },
        });
      }
      if ((await repo.list()).length >= maxTickers) {
        return reply.code(409).send({
          error: { code: 'watchlist_full', message: `The watchlist is limited to ${maxTickers} tickers.` },
        });
      }
      if ((await repo.add(symbol)) === 'duplicate') {
        return reply.code(409).send({
          error: { code: 'duplicate_symbol', message: `${symbol} is already on your watchlist.` },
        });
      }
      const added = (await repo.list()).find((t) => t.symbol === symbol);
      return reply.code(201).send({ symbol, createdAt: added?.createdAt ?? new Date().toISOString() });
    });
  };
