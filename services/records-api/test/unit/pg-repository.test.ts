import { describe, expect, it } from 'vitest';
import { PgWatchlistRepository } from '../../src/watchlist/pg-repository.js';

function stubPool(insertRowCount: number) {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      calls.push(sql.trim().split(/\s+/)[0]!.toUpperCase());
      return { rowCount: sql.includes('watchlist_tickers') ? insertRowCount : 1, rows: [] };
    },
    release: () => {},
  };
  return { calls, pool: { connect: async () => client, query: async () => ({ rows: [] }) } };
}

describe('PgWatchlistRepository', () => {
  it('returns duplicate when no row was inserted', async () => {
    const { pool, calls } = stubPool(0);
    const repo = new PgWatchlistRepository(pool as never);
    expect(await repo.add('AAPL')).toBe('duplicate');
    expect(calls).not.toContain('COMMIT');
    expect(calls.filter((c) => c === 'INSERT')).toHaveLength(1);
  });

  it('writes the audit record in the same transaction as the add', async () => {
    const { pool, calls } = stubPool(1);
    const repo = new PgWatchlistRepository(pool as never);
    expect(await repo.add('AAPL')).toBe('added');
    expect(calls).toEqual(['BEGIN', 'INSERT', 'INSERT', 'COMMIT']);
  });
});
