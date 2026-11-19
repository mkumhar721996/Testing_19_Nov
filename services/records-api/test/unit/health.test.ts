import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { testDeps } from '../support/test-deps.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = buildApp(testDeps());
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
