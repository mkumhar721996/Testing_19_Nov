import { describe, expect, it, vi } from 'vitest';
import { createEntraIdentityProvider } from '../../src/auth/entra-identity-provider.js';

const cfg = { tenantId: 'tenant', clientId: 'client' };

describe('Entra identity provider', () => {
  it('maps invalid_grant to null', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    const idp = createEntraIdentityProvider(cfg, fetchFn as unknown as typeof fetch);
    expect(await idp.verifyCredentials('a@test', 'bad')).toBeNull();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('maps a response without id_token to null', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    const idp = createEntraIdentityProvider(cfg, fetchFn as unknown as typeof fetch);
    expect(await idp.verifyCredentials('a@test', 'bad')).toBeNull();
  });
});
