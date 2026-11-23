import { SignJWT, jwtVerify } from 'jose';

export interface SessionService {
  issue(userId: string): Promise<string>;
  verify(token: string): Promise<{ userId: string } | null>;
}

/** Session tokens are issued and accepted only by this API (ADR-0004). */
export function createSessionService(cfg: { secret: string; ttlSeconds: number }): SessionService {
  const key = new TextEncoder().encode(cfg.secret);
  return {
    issue: (userId) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${cfg.ttlSeconds}s`)
        .sign(key),
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        return payload.sub ? { userId: payload.sub } : null;
      } catch {
        return null;
      }
    },
  };
}
