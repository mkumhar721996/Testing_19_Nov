import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

export interface SqlClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

async function files(dir: string, suffix: '.sql' | '.down.sql'): Promise<string[]> {
  const names = await readdir(dir);
  return names
    .filter((n) => (suffix === '.sql' ? n.endsWith('.sql') && !n.endsWith('.down.sql') : n.endsWith('.down.sql')))
    .sort();
}

/** Applies the pending `.sql` files in filename order; returns the names it applied. */
export async function runMigrations(client: SqlClient, dir = defaultDir): Promise<string[]> {
  await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await client.query('select name from schema_migrations')).rows.map((r) => String(r.name)));
  const applied: string[] = [];
  for (const name of await files(dir, '.sql')) {
    if (done.has(name)) continue;
    await client.query('begin');
    try {
      await client.query(await readFile(path.join(dir, name), 'utf8'));
      await client.query('insert into schema_migrations (name) values ($1)', [name]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
    applied.push(name);
  }
  return applied;
}

/** Reverses an applied migration with its `.down.sql` file. */
export async function revertMigration(client: SqlClient, name: string, dir = defaultDir): Promise<void> {
  const down = name.replace(/\.sql$/, '.down.sql');
  if (!(await files(dir, '.down.sql')).includes(down)) throw new Error(`No down migration for ${name}`);
  await client.query('begin');
  try {
    await client.query(await readFile(path.join(dir, down), 'utf8'));
    await client.query('delete from schema_migrations where name = $1', [name]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set; cannot run migrations.');
    process.exit(1);
  }
  const pool = createPool(url);
  runMigrations(pool)
    .then((applied) => console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'No pending migrations.'))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
