import { MemoryAuditLog, PgAuditLog } from '../../src/audit/audit.js';
import type { AppDeps } from '../../src/app.js';
import type { TokenVerifier } from '../../src/auth/auth.js';
import { createPool } from '../../src/db/pool.js';
import { MemoryOfferingRepository } from '../../src/offerings/memory-repository.js';
import { PgOfferingRepository } from '../../src/offerings/pg-repository.js';
import { MemoryServiceTypeRepository } from '../../src/service-types/memory-repository.js';
import { MemoryRequestRepository } from '../../src/service-types/memory-requests-repository.js';
import { PgRequestRepository, PgServiceTypeRepository } from '../../src/service-types/pg-repository.js';

// Test-only: "test-admin" and "test-provider" tokens. Never imported by src/.
export const testVerifier: TokenVerifier = {
  async verify(token) {
    if (token === 'test-admin') return { id: 'admin-1', role: 'admin' };
    if (token === 'test-provider') return { id: 'provider-1', role: 'provider' };
    throw new Error('invalid token');
  },
};

export function testDeps(): AppDeps {
  if (!process.env.DATABASE_URL) {
    const serviceTypes = new MemoryServiceTypeRepository();
    return {
      verifier: testVerifier,
      serviceTypes,
      requests: new MemoryRequestRepository(),
      offerings: new MemoryOfferingRepository(serviceTypes),
      audit: new MemoryAuditLog(),
    };
  }
  const pool = createPool();
  return {
    verifier: testVerifier,
    serviceTypes: new PgServiceTypeRepository(pool),
    requests: new PgRequestRepository(pool),
    offerings: new PgOfferingRepository(pool),
    audit: new PgAuditLog(pool),
  };
}
