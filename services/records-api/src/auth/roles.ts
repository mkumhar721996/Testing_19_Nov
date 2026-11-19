export type Role = 'wfc_admin' | 'fundraising_consultant' | 'org_admin' | 'org_staff';

export const ROLE_LABELS: Record<Role, string> = {
  wfc_admin: 'WFC Admin',
  fundraising_consultant: 'Fundraising Consultant',
  org_admin: 'Org Admin',
  org_staff: 'Org Staff',
};

export type RoleResolution =
  | { ok: true; role: Role }
  | { ok: false; reason: 'no_role' | 'multiple_roles' };

function isRole(value: string): value is Role {
  return Object.hasOwn(ROLE_LABELS, value);
}

/** A user is recognised only when they hold exactly one of the four roles. */
export function resolveRole(roles: readonly string[]): RoleResolution {
  const held = [...new Set(roles.filter(isRole))];
  if (held.length === 0) return { ok: false, reason: 'no_role' };
  if (held.length > 1) return { ok: false, reason: 'multiple_roles' };
  return { ok: true, role: held[0] };
}
