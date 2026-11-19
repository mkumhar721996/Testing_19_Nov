import { expect, test } from '@playwright/test';
import pg from 'pg';

// Needs a PostgreSQL named by DATABASE_URL (migrated and seeded by the webServer command).
test.skip(!process.env.DATABASE_URL, 'DATABASE_URL is not set');

const admin = { authorization: 'Bearer test-admin' };
const provider = { authorization: 'Bearer test-provider' };

test.describe.configure({ mode: 'serial' });

test('admin sees the starter list', async ({ request }) => {
  const res = await request.get('/admin/service-types', { headers: admin });
  expect(res.status()).toBe(200);
  const names = (await res.json()).map((t: { name: string }) => t.name);
  expect(names).toEqual(expect.arrayContaining(['Plumbing', 'Cleaning', 'Electrical', 'Gardening']));
});

test('add, rename and retire round-trip; the unique index rejects duplicates', async ({ request }) => {
  const name = `Locksmith ${Date.now()}`;
  const created = await request.post('/admin/service-types', { headers: admin, data: { name } });
  expect(created.status()).toBe(201);
  const { id } = await created.json();

  const dup = await request.post('/admin/service-types', { headers: admin, data: { name: `  ${name.toUpperCase()} ` } });
  expect(dup.status()).toBe(409);
  const dupPlumbing = await request.post('/admin/service-types', { headers: admin, data: { name: '  plumbing ' } });
  expect(dupPlumbing.status()).toBe(409);

  const renamed = await request.patch(`/admin/service-types/${id}`, { headers: admin, data: { name: `${name} Pro` } });
  expect((await renamed.json()).name).toBe(`${name} Pro`);

  expect((await request.post(`/admin/service-types/${id}/retire`, { headers: admin })).status()).toBe(200);
  const offered = (await (await request.get('/service-types', { headers: provider })).json()).map((t: { name: string }) => t.name);
  expect(offered).not.toContain(`${name} Pro`);
  const all = await (await request.get('/admin/service-types', { headers: admin })).json();
  expect(all.find((t: { id: string }) => t.id === id).status).toBe('retired');
});

test('a provider cannot add a type', async ({ request }) => {
  const res = await request.post('/admin/service-types', { headers: provider, data: { name: 'Blocked type' } });
  expect(res.status()).toBe(403);
});

test('a retired type still joins into the provider offerings', async ({ request }) => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const name = `Pest control ${Date.now()}`;
  const created = await request.post('/admin/service-types', { headers: admin, data: { name } });
  const { id } = await created.json();
  await pool.query(
    "insert into offerings (provider_id, service_type_id, price_amount, price_unit) values ('provider-1', $1, 80, 'fixed')",
    [id],
  );
  await request.post(`/admin/service-types/${id}/retire`, { headers: admin });
  const res = await request.get('/provider/offerings', { headers: provider });
  expect(await res.json()).toContainEqual({ serviceType: name, price: { amount: '80.00', unit: 'fixed' }, typeStatus: 'retired' });
  await pool.end();
});

test('a provider request is stored', async ({ request }) => {
  const res = await request.post('/service-type-requests', { headers: provider, data: { name: 'Roofing' } });
  expect(res.status()).toBe(201);
  expect(await res.json()).toEqual({ requested: true });
});
