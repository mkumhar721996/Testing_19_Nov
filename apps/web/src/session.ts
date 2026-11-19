export type Role = 'provider' | 'admin'

// Stand-in for the Entra ID sign-in session (ADR-0004); replaced by the sign-in story.
const ACTORS: Record<Role, string> = { provider: 'p1', admin: 'a1' }

export function actorHeaders(role: Role): Record<string, string> {
  return { 'x-actor-id': ACTORS[role], 'x-actor-role': role }
}
