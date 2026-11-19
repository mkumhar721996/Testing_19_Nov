import { describe, expect, it } from 'vitest';
import { seed } from '../../src/db/seed.js';
import { MemoryServiceTypeRepository } from '../../src/service-types/memory-repository.js';
import { STARTER_SERVICE_TYPES } from '../../src/service-types/seed-data.js';
import { admin, provider, setup } from './helpers.js';

type Row = { id: string; name: string; status: string; providersStillOffering: number };
const names = (rows: { name: string }[]) => rows.map((t) => t.name);

describe('admin service types', () => {
  it('AC1: lists the seeded starter types', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin });
    expect(res.statusCode).toBe(200);
    expect(names(res.json())).toEqual(STARTER_SERVICE_TYPES);
  });

  it('AC1: seeding twice adds nothing', async () => {
    const repo = new MemoryServiceTypeRepository();
    await seed(repo);
    await seed(repo);
    expect((await repo.listAll()).length).toBe(STARTER_SERVICE_TYPES.length);
  });

  it('AC2: add appears in the list, bad input refused, audited', async () => {
    const { app, audit } = await setup();
    const post = (payload: unknown) =>
      app.inject({ method: 'POST', url: '/admin/service-types', headers: admin, payload: payload as object });
    expect((await post({ name: 'Locksmith' })).statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin });
    expect(names(list.json())).toContain('Locksmith');
    expect((await post({ name: '   ' })).statusCode).toBe(400);
    expect((await post({ name: 'x'.repeat(81) })).statusCode).toBe(400);
    expect((await post({ name: 'plumbing' })).statusCode).toBe(409);
    expect(audit.records).toContainEqual(
      expect.objectContaining({ actorId: 'admin-1', action: 'service_type.created' }),
    );
  });

  it('AC3: rename shows the new name in place', async () => {
    const { app, audit } = await setup();
    const list = (await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin })).json() as Row[];
    const gardening = list.find((t) => t.name === 'Gardening')!;
    const patch = (id: string, payload: object) =>
      app.inject({ method: 'PATCH', url: `/admin/service-types/${id}`, headers: admin, payload });
    const res = await patch(gardening.id, { name: 'Garden care' });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Garden care');
    const after = (await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin })).json() as Row[];
    expect(names(after)).toContain('Garden care');
    expect(names(after)).not.toContain('Gardening');
    expect((await patch('00000000-0000-0000-0000-000000000000', { name: 'X' })).statusCode).toBe(404);
    expect((await patch(gardening.id, { name: '' })).statusCode).toBe(400);
    expect((await patch(gardening.id, { name: 'cleaning' })).statusCode).toBe(409);
    expect(audit.records).toContainEqual(expect.objectContaining({ action: 'service_type.renamed' }));
  });

  it('AC4: retire removes from the providers list but not the admin list', async () => {
    const { app, audit } = await setup();
    const list = (await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin })).json() as Row[];
    const gardening = list.find((t) => t.name === 'Gardening')!;
    const retire = () =>
      app.inject({ method: 'POST', url: `/admin/service-types/${gardening.id}/retire`, headers: admin });
    expect((await retire()).statusCode).toBe(200);
    expect((await retire()).statusCode).toBe(200);
    const offered = await app.inject({ method: 'GET', url: '/service-types', headers: provider });
    expect(names(offered.json())).not.toContain('Gardening');
    const all = (await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin })).json() as Row[];
    expect(all.find((t) => t.id === gardening.id)?.status).toBe('retired');
    expect(audit.records).toContainEqual(expect.objectContaining({ action: 'service_type.retired' }));
    const missing = await app.inject({
      method: 'POST',
      url: '/admin/service-types/00000000-0000-0000-0000-000000000000/retire',
      headers: admin,
    });
    expect(missing.statusCode).toBe(404);
  });

  it('AC6: providers only see offered types, without internal fields', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'GET', url: '/service-types', headers: provider });
    expect(names(res.json())).toEqual(STARTER_SERVICE_TYPES);
    expect(res.json().every((t: object) => !('retiredAt' in t))).toBe(true);
  });

  it('AC7: a provider cannot add, rename or retire; no token is 401', async () => {
    const { app, serviceTypes } = await setup();
    const id = (await serviceTypes.listAll())[0]!.id;
    const add = await app.inject({ method: 'POST', url: '/admin/service-types', headers: provider, payload: { name: 'Locksmith' } });
    expect(add.statusCode).toBe(403);
    expect(names(await serviceTypes.listAll())).not.toContain('Locksmith');
    const ren = await app.inject({ method: 'PATCH', url: `/admin/service-types/${id}`, headers: provider, payload: { name: 'X' } });
    expect(ren.statusCode).toBe(403);
    const ret = await app.inject({ method: 'POST', url: `/admin/service-types/${id}/retire`, headers: provider });
    expect(ret.statusCode).toBe(403);
    expect((await serviceTypes.listAll())[0]!.retiredAt).toBeNull();
    const anon = await app.inject({ method: 'POST', url: '/admin/service-types', payload: { name: 'X' } });
    expect(anon.statusCode).toBe(401);
  });

  it('AC8: a retired type still shows on the provider offering with its price', async () => {
    const { app, serviceTypes, offerings } = await setup();
    const pest = await serviceTypes.create('Pest control');
    offerings.add({ providerId: 'provider-1', serviceTypeId: pest.id, amount: '80.00', unit: 'fixed' });
    await app.inject({ method: 'POST', url: `/admin/service-types/${pest.id}/retire`, headers: admin });
    const res = await app.inject({ method: 'GET', url: '/provider/offerings', headers: provider });
    expect(res.json()).toContainEqual({
      serviceType: 'Pest control',
      price: { amount: '80.00', unit: 'fixed' },
      typeStatus: 'retired',
    });
    const all = (await app.inject({ method: 'GET', url: '/admin/service-types', headers: admin })).json() as Row[];
    expect(all.find((t) => t.name === 'Pest control')?.providersStillOffering).toBe(1);
  });
});
