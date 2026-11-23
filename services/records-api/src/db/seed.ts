import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPool } from './pool.js';

/** Runs every .sql file in db/seed in name order: `tsx src/db/seed.ts`. Seeds are idempotent. */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const dir = join(process.cwd(), 'db', 'seed');
const pool = createPool(databaseUrl);
try {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(readFileSync(join(dir, file), 'utf8'));
    console.log(`seed: applied ${file}`);
  }
} finally {
  await pool.end();
}
