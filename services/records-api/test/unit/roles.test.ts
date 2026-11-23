import { describe, expect, it } from 'vitest';
import { ROLE_LABELS, resolveRole } from '../../src/auth/roles.js';

describe('resolveRole', () => {
  it.each(Object.keys(ROLE_LABELS))('accepts exactly %s', (role) => {
    expect(resolveRole([role])).toEqual({ ok: true, role });
  });
  it('rejects no roles', () => {
    expect(resolveRole([])).toEqual({ ok: false, reason: 'no_role' });
  });
  it('rejects an unknown role as no role', () => {
    expect(resolveRole(['superuser'])).toEqual({ ok: false, reason: 'no_role' });
  });
  it('rejects more than one role', () => {
    expect(resolveRole(['org_admin', 'org_staff'])).toEqual({ ok: false, reason: 'multiple_roles' });
  });
});
