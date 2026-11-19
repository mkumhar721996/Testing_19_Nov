import { buildApp } from '../../src/app.js';
import type { AuthDeps } from '../../src/routes/auth.js';
import type { IdentityProvider } from '../../src/auth/identity-provider.js';
import { createSessionService } from '../../src/auth/session.js';
import type { UserRecord, UserRepository } from '../../src/auth/user-repository.js';

export const org = { id: 'org-1', name: 'Org One' };

export function makeUser(id: string, roles: string[], organization: UserRecord['organization'] = null): UserRecord {
  return { id, email: `${id}@test`, displayName: `User ${id}`, roles, organization };
}

export const seededUsers: UserRecord[] = [
  makeUser('admin', ['wfc_admin']),
  makeUser('wfc_admin', ['wfc_admin']),
  makeUser('fundraising_consultant', ['fundraising_consultant']),
  makeUser('org_admin', ['org_admin'], org),
  makeUser('org_staff', ['org_staff'], org),
  makeUser('org_admin_noorg', ['org_admin']),
  makeUser('org_staff_noorg', ['org_staff']),
  makeUser('norole', []),
  makeUser('multirole', ['org_admin', 'org_staff']),
];

export function inMemoryUsers(users: UserRecord[]): UserRepository {
  return {
    findBySubject: async (subject) => users.find((u) => u.identitySubject === subject) ?? null,
    linkSubject: async (userId, subject) => {
      const u = users.find((x) => x.id === userId);
      if (!u || u.identitySubject) return false;
      u.identitySubject = subject;
      return true;
    },
    findByEmail: async (email) => users.find((u) => u.email === email) ?? null,
    findById: async (id) => users.find((u) => u.id === id) ?? null,
  };
}

export const fakeIdentity: IdentityProvider = {
  verifyCredentials: async (email, password) =>
    password === 'correct' ? { subject: `sub-${email}`, email } : null,
};

export const sessions = createSessionService({ secret: 'test-secret-for-unit-tests-only-0123456789', ttlSeconds: 60 });

export function buildTestApp(users: UserRecord[] = seededUsers, limits?: AuthDeps['limits']) {
  const repo = inMemoryUsers(users.map((u) => ({ ...u })));
  const app = buildApp({ identity: fakeIdentity, users: repo, sessions, limits });
  const signIn = (email: string, password = 'correct') =>
    app.inject({ method: 'POST', url: '/auth/sign-in', payload: { email, password } });
  return { app, signIn };
}
