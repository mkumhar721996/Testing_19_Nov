import { describe, expect, it } from 'vitest';
import { buildTestApp, makeUser, seededUsers } from './helpers.js';

describe('POST /auth/sign-in', () => {
  it('signs in with valid credentials and the token opens /me', async () => {
    const { app, signIn } = buildTestApp();
    const res = await signIn('admin@test');
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().token).toBe('string');
    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${res.json().token}` },
    });
    expect(me.statusCode).toBe(200);
    await app.close();
  });

  it.each([
    ['wfc_admin', 'WFC Admin'],
    ['fundraising_consultant', 'Fundraising Consultant'],
    ['org_admin', 'Org Admin'],
    ['org_staff', 'Org Staff'],
  ])('recognises %s', async (role, label) => {
    const { app, signIn } = buildTestApp();
    const res = await signIn(`${role}@test`);
    expect(res.json().user.role).toBe(role);
    expect(res.json().user.roleLabel).toBe(label);
    await app.close();
  });

  it('ties an org account to exactly one organization', async () => {
    const { app, signIn } = buildTestApp();
    const res = await signIn('org_admin@test');
    expect(res.json().user.organization).toEqual({ id: 'org-1', name: 'Org One' });
    await app.close();
  });

  it('does not sign in an account with no role and says why', async () => {
    const { app, signIn } = buildTestApp();
    const res = await signIn('norole@test');
    expect(res.statusCode).toBe(403);
    expect(res.json().token).toBeUndefined();
    expect(res.json().code).toBe('no_role');
    expect(res.json().message).toBe('Your account has no role assigned. Contact your administrator.');
    await app.close();
  });

  it.each(['org_admin_noorg', 'org_staff_noorg'])('signs in %s with no organization', async (id) => {
    const { app, signIn } = buildTestApp();
    const res = await signIn(`${id}@test`);
    expect(res.statusCode).toBe(200);
    expect(res.json().user.organization).toBeNull();
    await app.close();
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const { app, signIn } = buildTestApp();
    const wrong = await signIn('org_admin@test', 'wrong');
    const unknown = await signIn('nobody@test', 'wrong');
    const unknownValid = await signIn('nobody@test', 'correct');
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ code: 'invalid_credentials', message: 'Incorrect email or password.' });
    expect(unknown.json()).toEqual(wrong.json());
    expect(unknownValid.statusCode).toBe(401);
    expect(unknownValid.json()).toEqual(wrong.json());
    await app.close();
  });

  it('does not reveal a role problem when the password is wrong', async () => {
    const { app, signIn } = buildTestApp();
    const res = await signIn('norole@test', 'wrong');
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_credentials');
    await app.close();
  });

  it('does not sign in an account with more than one role', async () => {
    const { app, signIn } = buildTestApp();
    const res = await signIn('multirole@test');
    expect(res.statusCode).toBe(403);
    expect(res.json().token).toBeUndefined();
    expect(res.json().code).toBe('multiple_roles');
    await app.close();
  });

  it('rejects an email already bound to a different subject', async () => {
    const bound = { ...makeUser('admin', ['wfc_admin']), identitySubject: 'someone-else' };
    const { app, signIn } = buildTestApp([bound]);
    const res = await signIn('admin@test');
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_credentials');
    await app.close();
  });

  it('signs in by subject even when the email claim has changed', async () => {
    const bound = { ...makeUser('admin', ['wfc_admin']), identitySubject: 'sub-new@test' };
    const { app, signIn } = buildTestApp([bound]);
    expect((await signIn('new@test')).statusCode).toBe(200);
    await app.close();
  });

  it('throttles repeated attempts for one email', async () => {
    const { app, signIn } = buildTestApp(seededUsers, { perEmail: 3 });
    for (let i = 0; i < 3; i++) expect((await signIn('admin@test', 'wrong')).statusCode).toBe(401);
    const res = await signIn('admin@test');
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe('too_many_attempts');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect((await signIn('org_admin@test')).statusCode).toBe(200);
    await app.close();
  });

  it('throttles repeated attempts from one IP', async () => {
    const { app, signIn } = buildTestApp(seededUsers, { perIp: 2 });
    await signIn('a@test', 'wrong');
    await signIn('b@test', 'wrong');
    expect((await signIn('admin@test')).statusCode).toBe(429);
    await app.close();
  });

  it('rejects a malformed body', async () => {
    const { app } = buildTestApp();
    const res = await app.inject({ method: 'POST', url: '/auth/sign-in', payload: { email: 1 } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
