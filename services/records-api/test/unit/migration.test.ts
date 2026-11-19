import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { revertMigration, runMigrations, type SqlClient } from '../../src/db/migrate.js';

const dir = path.resolve(__dirname, '../../migrations');

function stubClient(applied: string[] = []) {
  const log: string[] = [];
  const client: SqlClient = {
    async query(sql, params) {
      log.push(sql.trim().split('\n')[0]);
      if (sql.startsWith('select name')) return { rows: applied.map((name) => ({ name })) };
      if (params && sql.startsWith('insert')) applied.push(String(params[0]));
      return { rows: [] };
    },
  };
  return { client, log, applied };
}

describe('0001_provider_availability migration', () => {
  it('declares one block per weekday at the database level (AC13)', async () => {
    const sql = await readFile(path.join(dir, '0001_provider_availability.sql'), 'utf8');
    expect(sql).toMatch(/primary key \(provider_id, weekday\)/);
    expect(sql).toMatch(/check \(end_time > start_time\)/);
  });

  it('applies the up file once and records it', async () => {
    const { client, log, applied } = stubClient();
    const names = ['0001_provider_availability.sql', '0002_users_roles_organizations.sql'];
    expect(await runMigrations(client, dir)).toEqual(names);
    expect(applied).toEqual(names);
    expect(log).toContain('begin');
    expect(log).toContain('commit');
    expect(await runMigrations(client, dir)).toEqual([]);
  });

  it('reverses cleanly with the down file', async () => {
    const { client, log } = stubClient(['0001_provider_availability.sql']);
    await revertMigration(client, '0001_provider_availability.sql', dir);
    expect(log).toContain('drop table if exists audit_records;');
    expect(log).toContain('commit');
  });

  it('rolls back when the migration fails', async () => {
    const log: string[] = [];
    const client: SqlClient = {
      async query(sql) {
        log.push(sql.trim().split('\n')[0]);
        if (sql.startsWith('create table provider_availability')) throw new Error('boom');
        return { rows: [] };
      },
    };
    await expect(runMigrations(client, dir)).rejects.toThrow('boom');
    expect(log).toContain('rollback');
  });
});
