import { randomUUID } from 'node:crypto';
import type { ServiceTypeRequestRepository } from './repository.js';

export interface ServiceTypeRequestRow {
  id: string;
  providerId: string;
  requestedName: string;
}

export class MemoryRequestRepository implements ServiceTypeRequestRepository {
  private rows: ServiceTypeRequestRow[] = [];
  async add(providerId: string, requestedName: string) {
    const row = { id: randomUUID(), providerId, requestedName };
    this.rows.push(row);
    return row;
  }
  all() {
    return [...this.rows];
  }
}
