import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';

afterEach(() => vi.unstubAllEnvs());

const asCustomer = { 'x-user-id': 'cust-1' };

describe('default actor resolver', () => {
  it('fails closed with 401 in production even when x-user-id is sent', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/bookings', headers: asCustomer });
    expect(res.statusCode).toBe(401);
  });

  it('fails closed when NODE_ENV is unset', async () => {
    vi.stubEnv('NODE_ENV', '');
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/bookings', headers: asCustomer });
    expect(res.statusCode).toBe(401);
  });

  it('accepts the header actor in test and development', async () => {
    for (const env of ['test', 'development']) {
      vi.stubEnv('NODE_ENV', env);
      const app = buildApp();
      const res = await app.inject({ method: 'GET', url: '/bookings', headers: asCustomer });
      expect(res.statusCode).toBe(200);
    }
  });

  it('uses an injected resolver in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = buildApp({ resolveActor: () => 'cust-1' });
    const res = await app.inject({ method: 'GET', url: '/bookings' });
    expect(res.statusCode).toBe(200);
  });
});
