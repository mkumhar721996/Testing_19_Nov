import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { fakeIdentity, inMemoryUsers, makeUser, sessions } from './helpers.js';

describe('GET /me', () => {
  it('returns 401 without a token', async () => {
    const app = buildApp({ identity: fakeIdentity, users: inMemoryUsers([]), sessions });
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    await app.close();
  });

  it('returns 401 for an invalid token', async () => {
    const app = buildApp({ identity: fakeIdentity, users: inMemoryUsers([]), sessions });
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer nope' } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it.each([[[]], [['org_admin', 'org_staff']]])('returns 401 once roles change to %j', async (roles) => {
    const user = makeUser('u1', ['org_admin']);
    const app = buildApp({ identity: fakeIdentity, users: inMemoryUsers([user]), sessions });
    const token = await sessions.issue('u1');
    const headers = { authorization: `Bearer ${token}` };
    expect((await app.inject({ method: 'GET', url: '/me', headers })).statusCode).toBe(200);
    user.roles = roles;
    expect((await app.inject({ method: 'GET', url: '/me', headers })).statusCode).toBe(401);
    await app.close();
  });
});
