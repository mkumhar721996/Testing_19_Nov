import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Actor, Role } from '../profiles/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: Actor;
  }
}

/**
 * Temporary stand-in for Entra ID sign-in (ADR-0004): reads the actor from
 * `x-actor-id` and `x-actor-role` headers. Not secure; the sign-in story replaces it.
 * Routes depend only on `request.actor`.
 */
export function readActor(request: FastifyRequest): Actor | undefined {
  const id = request.headers['x-actor-id'];
  const role = request.headers['x-actor-role'];
  if (typeof id !== 'string' || !id) return undefined;
  if (role !== 'provider' && role !== 'admin') return undefined;
  return { id, role };
}

export function requireRole(role: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const actor = readActor(request);
    if (!actor) return reply.code(401).send({ message: 'Sign in to continue.' });
    if (actor.role !== role) return reply.code(403).send({ message: 'You do not have access to this.' });
    request.actor = actor;
  };
}
