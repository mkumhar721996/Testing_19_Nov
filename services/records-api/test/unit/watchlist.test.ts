import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { MemoryWatchlistRepository } from '../../src/watchlist/memory-repository.js';

const symbols = async (app: ReturnType<typeof buildApp>) =>
  (await app.inject({ method: 'GET', url: '/watchlist' }))
    .json()
    .tickers.map((t: { symbol: string }) => t.symbol);

describe('watchlist routes', () => {
  it('returns an empty list on a fresh app', async () => {
    const app = buildApp({ watchlist: new MemoryWatchlistRepository() });
    const res = await app.inject({ method: 'GET', url: '/watchlist' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tickers: [] });
  });

  it('adds symbols normalised, in insertion order', async () => {
    const app = buildApp({ watchlist: new MemoryWatchlistRepository() });
    await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'AAPL' } });
    const res = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'msft' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().symbol).toBe('MSFT');
    expect(await symbols(app)).toEqual(['AAPL', 'MSFT']);
  });

  it('rejects duplicate and invalid symbols and leaves the list unchanged', async () => {
    const app = buildApp({ watchlist: new MemoryWatchlistRepository() });
    await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'AAPL' } });
    const dup = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: ' aapl ' } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('duplicate_symbol');
    const bad = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'not a ticker!' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('invalid_symbol');
    expect(await symbols(app)).toEqual(['AAPL']);
  });

  it('rejects additions beyond the ticker cap with 409 watchlist_full', async () => {
    const app = buildApp({ watchlist: new MemoryWatchlistRepository(), watchlistLimits: { maxTickers: 2 } });
    await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'AAPL' } });
    await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'MSFT' } });
    const res = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: 'GOOG' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('watchlist_full');
    expect(await symbols(app)).toEqual(['AAPL', 'MSFT']);
  });

  it('rate limits POST /watchlist with 429 once the window budget is spent', async () => {
    const app = buildApp({
      watchlist: new MemoryWatchlistRepository(),
      watchlistLimits: { maxPostsPerWindow: 2, windowMs: 60_000 },
    });
    const post = (symbol: string) =>
      app.inject({ method: 'POST', url: '/watchlist', payload: { symbol } });
    expect((await post('AAPL')).statusCode).toBe(201);
    expect((await post('MSFT')).statusCode).toBe(201);
    const limited = await post('GOOG');
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('rate_limited');
    expect(await symbols(app)).toEqual(['AAPL', 'MSFT']);
  });

  it('rejects an empty or missing body', async () => {
    const app = buildApp({ watchlist: new MemoryWatchlistRepository() });
    const empty = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: '' } });
    expect(empty.statusCode).toBe(400);
    const missing = await app.inject({ method: 'POST', url: '/watchlist' });
    expect(missing.statusCode).toBe(400);
    expect(await symbols(app)).toEqual([]);
  });
});
