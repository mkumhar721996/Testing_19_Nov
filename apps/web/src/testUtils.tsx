import type { AuthUser } from './auth/types'

export const orgUser: AuthUser = {
  id: 'u1',
  displayName: 'Olivia OrgAdmin',
  email: 'org.admin@example.test',
  role: 'org_admin',
  roleLabel: 'Org Admin',
  organization: { id: 'org-1', name: 'Org One' },
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
