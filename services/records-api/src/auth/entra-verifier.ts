import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Principal, TokenVerifier } from './auth.js';

const ADMIN_ROLE = 'ServiceCatalog.Admin';

export function createEntraVerifier(tenantId: string, audience: string): TokenVerifier {
  const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  return {
    async verify(token): Promise<Principal> {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience });
      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      const id = typeof payload.oid === 'string' ? payload.oid : payload.sub;
      if (!id) throw new Error('token has no subject');
      return { id, role: roles.includes(ADMIN_ROLE) ? 'admin' : 'provider' };
    },
  };
}
