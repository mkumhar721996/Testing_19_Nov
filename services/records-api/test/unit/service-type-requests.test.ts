import { describe, expect, it } from 'vitest';
import { admin, provider, setup } from './helpers.js';

describe('POST /service-type-requests', () => {
  it('AC5: stores a request for an admin and audits it', async () => {
    const { app, requests, audit } = await setup();
    const post = (payload: object, headers = provider) =>
      app.inject({ method: 'POST', url: '/service-type-requests', headers, payload });
    const res = await post({ name: 'Locksmith' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ requested: true });
    expect(requests.all()).toEqual([expect.objectContaining({ providerId: 'provider-1', requestedName: 'Locksmith' })]);
    expect(audit.records).toContainEqual(expect.objectContaining({ action: 'service_type_request.created' }));
    expect((await post({ name: '' })).statusCode).toBe(400);
    expect((await post({ name: 'Locksmith' }, admin)).statusCode).toBe(403);
  });
});
