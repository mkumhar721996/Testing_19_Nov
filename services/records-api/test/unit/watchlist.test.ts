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

  it('rejects an empty or missing body', async () => {
    const app = buildApp({ watchlist: new MemoryWatchlistRepository() });
    const empty = await app.inject({ method: 'POST', url: '/watchlist', payload: { symbol: '' } });
    expect(empty.statusCode).toBe(400);
    const missing = await app.inject({ method: 'POST', url: '/watchlist' });
    expect(missing.statusCode).toBe(400);
    expect(await symbols(app)).toEqual([]);
  });
});
