import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

export type Role = 'admin' | 'provider';
export interface Principal {
  id: string;
  role: Role;
}
export interface TokenVerifier {
  verify(token: string): Promise<Principal>;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
}

export function authenticate(verifier: TokenVerifier): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) return reply.code(401).send({ error: 'Sign in to continue' });
    try {
      request.principal = await verifier.verify(token);
    } catch {
      return reply.code(401).send({ error: 'Sign in to continue' });
    }
  };
}

export function requireRole(role: Role): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    if (request.principal?.role !== role) {
      return reply.code(403).send({ error: `Only ${role}s can do this` });
    }
  };
}

export function principalOf(request: FastifyRequest): Principal {
  return request.principal!;
}
