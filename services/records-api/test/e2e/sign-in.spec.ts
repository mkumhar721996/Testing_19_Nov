import { expect, test } from '@playwright/test';

// Needs a PostgreSQL with `pnpm db:migrate && pnpm db:seed` applied, and the server started with
// IDENTITY_PROVIDER=fake (test only).
test.skip(!process.env.DATABASE_URL, 'DATABASE_URL is not set');

const signIn = (request: import('@playwright/test').APIRequestContext, email: string, password = 'correct') =>
  request.post('/auth/sign-in', { data: { email, password } });

for (const [email, role, label] of [
  ['wfc.admin@example.test', 'wfc_admin', 'WFC Admin'],
  ['consultant@example.test', 'fundraising_consultant', 'Fundraising Consultant'],
  ['org.admin@example.test', 'org_admin', 'Org Admin'],
  ['org.staff@example.test', 'org_staff', 'Org Staff'],
]) {
  test(`recognises ${role}`, async ({ request }) => {
    const res = await signIn(request, email);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe(role);
    expect(body.user.roleLabel).toBe(label);
    const me = await request.get('/me', { headers: { authorization: `Bearer ${body.token}` } });
    expect(me.status()).toBe(200);
  });
}

test('org admin with no organization signs in with no organization', async ({ request }) => {
  const res = await signIn(request, 'org.admin.noorg@example.test');
  expect(res.status()).toBe(200);
  expect((await res.json()).user.organization).toBeNull();
});

test('no role is refused', async ({ request }) => {
  const res = await signIn(request, 'norole@example.test');
  expect(res.status()).toBe(403);
  expect((await res.json()).code).toBe('no_role');
});

test('more than one role is refused', async ({ request }) => {
  const res = await signIn(request, 'multirole@example.test');
  expect(res.status()).toBe(403);
  expect((await res.json()).code).toBe('multiple_roles');
});

test('invalid credentials give a generic error', async ({ request }) => {
  const res = await signIn(request, 'org.admin@example.test', 'wrong');
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({ code: 'invalid_credentials', message: 'Incorrect email or password.' });
});
