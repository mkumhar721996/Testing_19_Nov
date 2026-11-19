import type { AuditEntry, AuditLog } from './types.js';

/** Keeps audit entries in memory (ADR-0011); a persistent store follows with the database. */
export class InMemoryAuditLog implements AuditLog {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}
