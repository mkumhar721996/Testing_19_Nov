import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { IdentityProvider } from './identity-provider.js';

export interface EntraConfig {
  tenantId: string;
  clientId: string;
}

/**
 * Exchanges the user's credentials with the Entra ID tenant token endpoint and verifies the
 * returned id_token against the tenant JWKS. The sign-in flow is still to be confirmed by the
 * identity owner; only this adapter changes if it is not a credential exchange.
 */
export function createEntraIdentityProvider(
  cfg: EntraConfig,
  fetchFn: typeof fetch = fetch,
): IdentityProvider {
  const authority = `https://login.microsoftonline.com/${cfg.tenantId}`;
  const jwks = createRemoteJWKSet(new URL(`${authority}/discovery/v2.0/keys`));

  return {
    async verifyCredentials(email, password) {
      try {
        const res = await fetchFn(`${authority}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: cfg.clientId,
            scope: 'openid profile email',
            username: email,
            password,
          }),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { id_token?: string };
        if (!body.id_token) return null;
        const { payload } = await jwtVerify(body.id_token, jwks, {
          issuer: `${authority}/v2.0`,
          audience: cfg.clientId,
        });
        const subject = payload.oid ?? payload.sub;
        if (typeof subject !== 'string') return null;
        const claimEmail = payload.preferred_username ?? payload.email;
        return { subject, email: typeof claimEmail === 'string' ? claimEmail : email };
      } catch {
        return null;
      }
    },
  };
}
