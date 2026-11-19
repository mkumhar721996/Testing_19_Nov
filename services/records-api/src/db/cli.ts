import { PgServiceTypeRepository } from '../service-types/pg-repository.js';
import { migrate } from './migrate.js';
import { createPool } from './pool.js';
import { seed } from './seed.js';

const pool = createPool();
try {
  const command = process.argv[2];
  if (command === 'migrate') await migrate(pool);
  else if (command === 'seed') await seed(new PgServiceTypeRepository(pool));
  else throw new Error('Usage: cli.ts migrate|seed');
} finally {
  await pool.end();
}
