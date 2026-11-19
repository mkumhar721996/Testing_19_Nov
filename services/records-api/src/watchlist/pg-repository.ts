import type { Pool } from 'pg';
import type { WatchlistRepository, WatchlistTicker } from './repository.js';

// Sign-in is not implemented yet, so every change is audited as this actor.
const ANONYMOUS_ACTOR = 'anonymous';

export class PgWatchlistRepository implements WatchlistRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<WatchlistTicker[]> {
    const res = await this.pool.query<{ symbol: string; created_at: Date }>(
      'SELECT symbol, created_at FROM watchlist_tickers ORDER BY created_at, symbol',
    );
    return res.rows.map((r) => ({ symbol: r.symbol, createdAt: new Date(r.created_at).toISOString() }));
  }

  async add(symbol: string): Promise<'added' | 'duplicate'> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        'INSERT INTO watchlist_tickers (symbol) VALUES ($1) ON CONFLICT (symbol) DO NOTHING',
        [symbol],
      );
      if (inserted.rowCount === 0) {
        await client.query('ROLLBACK');
        return 'duplicate';
      }
      await client.query('INSERT INTO audit_records (action, subject, actor) VALUES ($1, $2, $3)', [
        'watchlist.add',
        symbol,
        ANONYMOUS_ACTOR,
      ]);
      await client.query('COMMIT');
      return 'added';
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
