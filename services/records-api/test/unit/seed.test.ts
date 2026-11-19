import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync('migrations/0002_users_roles_organizations.sql', 'utf8');
const seedSql = readFileSync('db/seed/001_seed_accounts.sql', 'utf8');

describe('schema', () => {
  it('ties an account to at most one organization', () => {
    expect(migrationSql).toMatch(/organization_id\s+\S+\s+REFERENCES\s+organizations/i);
  });
  it('restricts roles to the four role codes', () => {
    for (const role of ['wfc_admin', 'fundraising_consultant', 'org_admin', 'org_staff']) {
      expect(migrationSql).toContain(`'${role}'`);
    }
  });
});

describe('seed', () => {
  it('is idempotent', () => {
    expect(seedSql).toMatch(/ON CONFLICT/i);
  });
  it('seeds an account for each role, plus the edge accounts', () => {
    for (const email of [
      'wfc.admin@example.test',
      'consultant@example.test',
      'org.admin@example.test',
      'org.staff@example.test',
      'org.admin.noorg@example.test',
      'norole@example.test',
      'multirole@example.test',
    ]) {
      expect(seedSql).toContain(email);
    }
  });
  it('ties each org account except the deliberate no-org one to an organization', () => {
    const rows = seedSql.split('\n').filter((l) => /org\.(admin|staff)[a-z.]*@example\.test/.test(l));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      if (row.includes('noorg')) expect(row).toMatch(/NULL/);
      else expect(row).toMatch(/'00000000-0000-0000-0000-00000000000[12]'/);
    }
  });
});
