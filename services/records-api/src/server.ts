import { buildApp } from './app.js';
import { createPool } from './db/pool.js';
import { PgWatchlistRepository } from './watchlist/pg-repository.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8011);

// DATABASE_URL is the PostgreSQL connection string. When unset the watchlist is kept in memory
// (development only: it is lost on restart).
const databaseUrl = process.env.DATABASE_URL;
const app = buildApp({
  watchlist: databaseUrl ? new PgWatchlistRepository(createPool(databaseUrl)) : undefined,
});
if (!databaseUrl) {
  app.log.warn('DATABASE_URL is not set; the watchlist is stored in memory and will not persist.');
}
app.listen({ host, port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
