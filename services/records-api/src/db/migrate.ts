import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

const dir = fileURLToPath(new URL('../../migrations/', import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL to the PostgreSQL connection string before running migrations.');
  process.exit(1);
}

const pool = createPool(url);
try {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(await readFile(dir + file, 'utf8'));
    console.log(`applied ${file}`);
  }
} finally {
  await pool.end();
}
