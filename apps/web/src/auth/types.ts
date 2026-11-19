export type RoleCode = 'wfc_admin' | 'fundraising_consultant' | 'org_admin' | 'org_staff'

export interface AuthUser {
  id: string
  displayName: string
  email: string
  role: RoleCode
  roleLabel: string
  organization: { id: string; name: string } | null
}

export type AuthResult =
  | { ok: true; token: string; user: AuthUser }
  | { ok: false; code: string; message: string }

export type MeResult = { ok: true; user: AuthUser } | { ok: false; code: string; message: string }
