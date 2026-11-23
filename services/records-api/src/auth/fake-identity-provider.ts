import type { IdentityProvider } from './identity-provider.js';

/** Test-only provider (config allows it only when NODE_ENV=test): every account's password is "correct". */
export const fakeIdentityProvider: IdentityProvider = {
  async verifyCredentials(email, password) {
    return password === 'correct' ? { subject: `fake-${email}`, email } : null;
  },
};
