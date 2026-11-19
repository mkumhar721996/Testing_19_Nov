import { randomUUID } from 'node:crypto';
import {
  DuplicateNameError,
  normaliseName,
  type ServiceTypeRepository,
  type ServiceTypeRow,
} from './repository.js';

export class MemoryServiceTypeRepository implements ServiceTypeRepository {
  private rows: ServiceTypeRow[] = [];

  async listAll() {
    return this.rows.map((r) => ({ ...r }));
  }
  async listOffered() {
    return (await this.listAll()).filter((r) => r.retiredAt === null);
  }
  async create(name: string) {
    this.assertFree(name);
    const row = { id: randomUUID(), name: name.trim(), retiredAt: null };
    this.rows.push(row);
    return { ...row };
  }
  async rename(id: string, name: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    this.assertFree(name, id);
    row.name = name.trim();
    return { ...row };
  }
  async retire(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return null;
    row.retiredAt ??= new Date();
    return { ...row };
  }

  private assertFree(name: string, exceptId?: string) {
    const taken = this.rows.some((r) => r.id !== exceptId && normaliseName(r.name) === normaliseName(name));
    if (taken) throw new DuplicateNameError();
  }
}
