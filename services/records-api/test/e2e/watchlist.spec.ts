import { expect, test } from '@playwright/test';

test('watchlist accepts a symbol once and rejects duplicates and invalid symbols', async ({ request }) => {
  expect((await request.post('/watchlist', { data: { symbol: 'AAPL' } })).status()).toBe(201);
  expect((await request.post('/watchlist', { data: { symbol: 'AAPL' } })).status()).toBe(409);
  expect((await request.post('/watchlist', { data: { symbol: '12$' } })).status()).toBe(400);
  const list = await (await request.get('/watchlist')).json();
  expect(list.tickers.filter((t: { symbol: string }) => t.symbol === 'AAPL')).toHaveLength(1);
});
