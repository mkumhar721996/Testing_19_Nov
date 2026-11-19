import type { FastifyPluginAsync } from 'fastify';
import type { WatchlistRepository } from '../watchlist/repository.js';
import { normalizeSymbol, validateSymbol } from '../watchlist/symbol.js';

export const watchlistRoutes =
  (repo: WatchlistRepository): FastifyPluginAsync =>
  async (app) => {
    app.get('/watchlist', async () => ({ tickers: await repo.list() }));

    app.post('/watchlist', async (request, reply) => {
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
      if ((await repo.add(symbol)) === 'duplicate') {
        return reply.code(409).send({
          error: { code: 'duplicate_symbol', message: `${symbol} is already on your watchlist.` },
        });
      }
      const added = (await repo.list()).find((t) => t.symbol === symbol);
      return reply.code(201).send({ symbol, createdAt: added?.createdAt ?? new Date().toISOString() });
    });
  };
