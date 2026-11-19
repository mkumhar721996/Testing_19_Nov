import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createSessionService } from '../../src/auth/session.js';

const secret = 'test-secret-for-unit-tests-only-0123456789';

describe('session service', () => {
  it('round-trips a user id', async () => {
    const s = createSessionService({ secret, ttlSeconds: 60 });
    expect(await s.verify(await s.issue('u1'))).toEqual({ userId: 'u1' });
  });

  it('rejects an expired token', async () => {
    const s = createSessionService({ secret, ttlSeconds: 60 });
    const key = new TextEncoder().encode(secret);
    const past = Math.floor(Date.now() / 1000) - 120;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setIssuedAt(past - 60)
      .setExpirationTime(past)
      .sign(key);
    expect(await s.verify(token)).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const s = createSessionService({ secret, ttlSeconds: 60 });
    const other = createSessionService({ secret: 'another-secret-for-unit-tests-9876543210', ttlSeconds: 60 });
    expect(await s.verify(await other.issue('u1'))).toBeNull();
  });

  it('rejects garbage', async () => {
    const s = createSessionService({ secret, ttlSeconds: 60 });
    expect(await s.verify('not-a-token')).toBeNull();
  });
});
