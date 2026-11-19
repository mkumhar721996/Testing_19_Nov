import { buildApp } from '../../src/app.js';
import type { Principal, TokenVerifier } from '../../src/auth/auth.js';
import { MemoryAuditLog } from '../../src/audit/audit.js';
import { MemoryServiceTypeRepository } from '../../src/service-types/memory-repository.js';
import { MemoryRequestRepository } from '../../src/service-types/memory-requests-repository.js';
import { MemoryOfferingRepository } from '../../src/offerings/memory-repository.js';
import { STARTER_SERVICE_TYPES } from '../../src/service-types/seed-data.js';

const principals: Record<string, Principal> = {
  admin: { id: 'admin-1', role: 'admin' },
  provider: { id: 'provider-1', role: 'provider' },
};

export const fakeVerifier: TokenVerifier = {
  async verify(token) {
    const principal = principals[token];
    if (!principal) throw new Error('invalid token');
    return principal;
  },
};

export const admin = { authorization: 'Bearer admin' };
export const provider = { authorization: 'Bearer provider' };

export async function setup() {
  const serviceTypes = new MemoryServiceTypeRepository();
  for (const name of STARTER_SERVICE_TYPES) await serviceTypes.create(name);
  const requests = new MemoryRequestRepository();
  const offerings = new MemoryOfferingRepository(serviceTypes);
  const audit = new MemoryAuditLog();
  const app = buildApp({ verifier: fakeVerifier, serviceTypes, requests, offerings, audit });
  return { app, serviceTypes, requests, offerings, audit };
}
