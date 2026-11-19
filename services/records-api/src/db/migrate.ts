import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

export async function migrate(pool: Pool, dir = path.resolve('migrations')) {
  await pool.query('create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql')).sort();
  for (const file of files) {
    const done = await pool.query('select 1 from schema_migrations where filename = $1', [file]);
    if (done.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(await readFile(path.join(dir, file), 'utf8'));
      await client.query('insert into schema_migrations (filename) values ($1)', [file]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }
}
