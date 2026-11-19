import type { Pool } from 'pg';
import type { UserRecord, UserRepository } from './user-repository.js';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
  organization_id: string | null;
  organization_name: string | null;
}

const SELECT_USER = `
  SELECT u.id, u.email, u.display_name, u.organization_id, o.name AS organization_name,
         COALESCE(array_agg(r.role) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
  FROM users u
  LEFT JOIN organizations o ON o.id = u.organization_id
  LEFT JOIN user_roles r ON r.user_id = u.id
`;
const GROUP_USER = 'GROUP BY u.id, o.id';

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    roles: row.roles,
    organization:
      row.organization_id && row.organization_name
        ? { id: row.organization_id, name: row.organization_name }
        : null,
  };
}

export function createPgUserRepository(pool: Pool): UserRepository {
  async function one(where: string, value: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRow>(`${SELECT_USER} WHERE ${where} ${GROUP_USER}`, [value]);
    return rows[0] ? toRecord(rows[0]) : null;
  }
  return {
    findByEmail: (email) => one('lower(u.email) = lower($1)', email),
    findById: (id) => one('u.id::text = $1', id),
  };
}
