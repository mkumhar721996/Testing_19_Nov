import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveRole, type Role } from './roles.js';
import type { SessionService } from './session.js';
import type { UserRecord, UserRepository } from './user-repository.js';

export interface SessionContext {
  user: UserRecord;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionContext;
  }
}

export const UNAUTHENTICATED = { code: 'unauthenticated', message: 'Sign in to continue.' };

/** Verifies the bearer token and reloads the user on every request, so a role change applies at once. */
export function createRequireSession(sessions: SessionService, users: UserRepository) {
  return async function requireSession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const session = token ? await sessions.verify(token) : null;
    const user = session ? await users.findById(session.userId) : null;
    const resolution = user ? resolveRole(user.roles) : null;
    if (!user || !resolution?.ok) {
      return reply.code(401).send(UNAUTHENTICATED);
    }
    req.session = { user, role: resolution.role };
  };
}
