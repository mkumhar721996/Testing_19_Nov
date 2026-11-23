import type { FastifyPluginAsync } from 'fastify';
import { createAttemptLimiter } from '../auth/attempt-limiter.js';
import type { IdentityProvider } from '../auth/identity-provider.js';
import { createRequireSession, type SessionContext } from '../auth/require-session.js';
import { ROLE_LABELS, resolveRole } from '../auth/roles.js';
import type { SessionService } from '../auth/session.js';
import type { UserRepository } from '../auth/user-repository.js';

export interface AuthDeps {
  identity: IdentityProvider;
  users: UserRepository;
  sessions: SessionService;
  limits?: Partial<SignInLimits>;
}

interface SignInLimits {
  perIp: number;
  perEmail: number;
  windowMs: number;
}
const DEFAULT_LIMITS: SignInLimits = { perIp: 50, perEmail: 10, windowMs: 15 * 60_000 };

const TOO_MANY_ATTEMPTS = { code: 'too_many_attempts', message: 'Too many sign-in attempts. Try again later.' };
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
  const { perIp, perEmail, windowMs } = { ...DEFAULT_LIMITS, ...deps.limits };
  const ipLimiter = createAttemptLimiter({ maxAttempts: perIp, windowMs });
  const emailLimiter = createAttemptLimiter({ maxAttempts: perEmail, windowMs });

  return async (app) => {
    app.post<{ Body: { email: string; password: string } }>(
      '/auth/sign-in',
      { schema: { body: signInBody } },
      async (req, reply) => {
        const { email, password } = req.body;
        const retryAfter = Math.max(
          ipLimiter.hit(req.ip),
          emailLimiter.hit(email.trim().toLowerCase()),
        );
        if (retryAfter > 0) {
          return reply.code(429).header('Retry-After', String(retryAfter)).send(TOO_MANY_ATTEMPTS);
        }
        const identity = await deps.identity.verifyCredentials(email, password);
        if (!identity) return reply.code(401).send(INVALID_CREDENTIALS);

        // Unknown accounts look the same as bad credentials; roles are checked only after credentials.
        // The account is bound to the immutable Entra subject; email only makes the first link.
        let user = await deps.users.findBySubject(identity.subject);
        if (!user) {
          user = await deps.users.findByEmail(identity.email);
          if (!user) return reply.code(401).send(INVALID_CREDENTIALS);
          if (user.identitySubject && user.identitySubject !== identity.subject) {
            return reply.code(401).send(INVALID_CREDENTIALS);
          }
          if (!user.identitySubject && !(await deps.users.linkSubject(user.id, identity.subject))) {
            return reply.code(401).send(INVALID_CREDENTIALS);
          }
        }

        const resolution = resolveRole(user.roles);
        if (!resolution.ok) return reply.code(403).send(ROLE_PROBLEMS[resolution.reason]);

        const token = await deps.sessions.issue(user.id);
        return { token, user: toUser({ user, role: resolution.role }) };
      },
    );

    app.get('/me', { preHandler: requireSession }, async (req) => toUser(req.session!));
  };
}
