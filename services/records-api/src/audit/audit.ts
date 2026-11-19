import type { Pool } from 'pg';

export interface AuditEntry {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  detail?: Record<string, unknown>;
}

// ADR-0011: every create, update and role change is written with actor and time.
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export class MemoryAuditLog implements AuditLog {
  records: (AuditEntry & { at: Date })[] = [];
  async record(entry: AuditEntry) {
    this.records.push({ ...entry, at: new Date() });
  }
}

export class PgAuditLog implements AuditLog {
  constructor(private pool: Pool) {}
  async record(e: AuditEntry) {
    await this.pool.query(
      'insert into audit_records (actor_id, action, entity, entity_id, detail) values ($1, $2, $3, $4, $5)',
      [e.actorId, e.action, e.entity, e.entityId, JSON.stringify(e.detail ?? {})],
    );
  }
}
