import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPool } from './pool.js';

/** Runs every .sql file of a db/ subfolder in name order: `tsx src/db/migrate.ts migrations|seed`. */
const folder = process.argv[2];
if (folder !== 'migrations' && folder !== 'seed') {
  console.error('usage: migrate.ts <migrations|seed>');
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const dir = join(process.cwd(), 'db', folder);
const pool = createPool(databaseUrl);
try {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(readFileSync(join(dir, file), 'utf8'));
    console.log(`${folder}: applied ${file}`);
  }
} finally {
  await pool.end();
}
