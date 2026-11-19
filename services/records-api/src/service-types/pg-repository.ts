import type { Pool } from 'pg';
import {
  DuplicateNameError,
  type ServiceTypeRepository,
  type ServiceTypeRequestRepository,
  type ServiceTypeRow,
} from './repository.js';

interface Db {
  id: string;
  name: string;
  retired_at: Date | null;
}
const toRow = (r: Db): ServiceTypeRow => ({ id: r.id, name: r.name, retiredAt: r.retired_at });
const UNIQUE_VIOLATION = '23505';
const INVALID_UUID = '22P02';

export class PgServiceTypeRepository implements ServiceTypeRepository {
  constructor(private pool: Pool) {}

  async listAll() {
    const r = await this.pool.query<Db>('select id, name, retired_at from service_types order by created_at, name');
    return r.rows.map(toRow);
  }
  async listOffered() {
    const r = await this.pool.query<Db>(
      'select id, name, retired_at from service_types where retired_at is null order by created_at, name',
    );
    return r.rows.map(toRow);
  }
  async create(name: string) {
    const row = await this.maybe('insert into service_types (name) values (btrim($1)) returning id, name, retired_at', [name]);
    return row!;
  }
  async rename(id: string, name: string) {
    return this.maybe(
      'update service_types set name = btrim($2), updated_at = now() where id = $1 returning id, name, retired_at',
      [id, name],
    );
  }
  async retire(id: string) {
    return this.maybe(
      'update service_types set retired_at = coalesce(retired_at, now()), updated_at = now() where id = $1 returning id, name, retired_at',
      [id],
    );
  }

  private async maybe(sql: string, params: unknown[]) {
    try {
      const r = await this.pool.query<Db>(sql, params);
      return r.rows[0] ? toRow(r.rows[0]) : null;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === UNIQUE_VIOLATION) throw new DuplicateNameError();
      if (code === INVALID_UUID) return null;
      throw err;
    }
  }
}

export class PgRequestRepository implements ServiceTypeRequestRepository {
  constructor(private pool: Pool) {}
  async add(providerId: string, requestedName: string) {
    const r = await this.pool.query<{ id: string }>(
      'insert into service_type_requests (provider_id, requested_name) values ($1, $2) returning id',
      [providerId, requestedName],
    );
    return r.rows[0]!;
  }
}
