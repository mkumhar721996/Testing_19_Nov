import type { FastifyPluginAsync } from 'fastify';
import type { IdentityProvider } from '../auth/identity-provider.js';
import { createRequireSession, type SessionContext } from '../auth/require-session.js';
import { ROLE_LABELS, resolveRole } from '../auth/roles.js';
import type { SessionService } from '../auth/session.js';
import type { UserRepository } from '../auth/user-repository.js';

export interface AuthDeps {
  identity: IdentityProvider;
  users: UserRepository;
  sessions: SessionService;
}

const INVALID_CREDENTIALS = { code: 'invalid_credentials', message: 'Incorrect email or password.' };
const ROLE_PROBLEMS = {
  no_role: {
    code: 'no_role',
    message: 'Your account has no role assigned. Contact your administrator.',
  },
  multiple_roles: {
    code: 'multiple_roles',
    message: 'Your account has more than one role assigned. Contact your administrator.',
  },
};

function toUser({ user, role }: SessionContext) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role,
    roleLabel: ROLE_LABELS[role],
    organization: user.organization,
  };
}

const signInBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: { email: { type: 'string' }, password: { type: 'string' } },
} as const;

export function authRoutes(deps: AuthDeps): FastifyPluginAsync {
  const requireSession = createRequireSession(deps.sessions, deps.users);

  return async (app) => {
    app.post<{ Body: { email: string; password: string } }>(
      '/auth/sign-in',
      { schema: { body: signInBody } },
      async (req, reply) => {
        const { email, password } = req.body;
        const identity = await deps.identity.verifyCredentials(email, password);
        if (!identity) return reply.code(401).send(INVALID_CREDENTIALS);

        // Unknown accounts look the same as bad credentials; roles are checked only after credentials.
        const user = await deps.users.findByEmail(identity.email);
        if (!user) return reply.code(401).send(INVALID_CREDENTIALS);

        const resolution = resolveRole(user.roles);
        if (!resolution.ok) return reply.code(403).send(ROLE_PROBLEMS[resolution.reason]);

        const token = await deps.sessions.issue(user.id);
        return { token, user: toUser({ user, role: resolution.role }) };
      },
    );

    app.get('/me', { preHandler: requireSession }, async (req) => toUser(req.session!));
  };
}
