import type { Weekday, WorkingHours } from './slots.js';
import type { AvailabilityStore, ProviderAvailability } from './types.js';

export interface AuditEntry {
  actorId: string;
  action: string;
  subject: string;
  occurredAt: Date;
}

interface ProviderRecord {
  timeZone: string | null;
  hours: Map<Weekday, WorkingHours>;
  daysOff: Set<string>;
}

/** Test-only store, selected by RECORDS_STORE=memory. */
export class InMemoryAvailabilityStore implements AvailabilityStore {
  readonly auditLog: AuditEntry[] = [];
  private readonly providers = new Map<string, ProviderRecord>();

  private record(providerId: string): ProviderRecord {
    let r = this.providers.get(providerId);
    if (!r) {
      r = { timeZone: null, hours: new Map(), daysOff: new Set() };
      this.providers.set(providerId, r);
    }
    return r;
  }

  private audit(actorId: string, action: string, subject: string): void {
    this.auditLog.push({ actorId, action, subject, occurredAt: new Date() });
  }

  async getAvailability(providerId: string, _actorId?: string): Promise<ProviderAvailability> {
    const r = this.providers.get(providerId);
    if (!r) return { timeZone: null, hours: [], daysOff: [] };
    return {
      timeZone: r.timeZone,
      hours: [...r.hours.values()].sort((a, b) => a.weekday - b.weekday).map((h) => ({ ...h })),
      daysOff: [...r.daysOff].sort(),
    };
  }

  async setTimeZone(providerId: string, timeZone: string, actorId: string): Promise<void> {
    this.record(providerId).timeZone = timeZone;
    this.audit(actorId, 'timezone.set', `${providerId}:${timeZone}`);
  }

  async createHours(providerId: string, h: WorkingHours, actorId: string): Promise<'created' | 'exists'> {
    const r = this.record(providerId);
    if (r.hours.has(h.weekday)) return 'exists';
    r.hours.set(h.weekday, { ...h });
    this.audit(actorId, 'hours.create', `${providerId}:${h.weekday}`);
    return 'created';
  }

  async updateHours(providerId: string, h: WorkingHours, actorId: string): Promise<'updated' | 'missing'> {
    const r = this.record(providerId);
    if (!r.hours.has(h.weekday)) return 'missing';
    r.hours.set(h.weekday, { ...h });
    this.audit(actorId, 'hours.update', `${providerId}:${h.weekday}`);
    return 'updated';
  }

  async deleteHours(providerId: string, weekday: Weekday, actorId: string): Promise<void> {
    if (this.record(providerId).hours.delete(weekday)) {
      this.audit(actorId, 'hours.delete', `${providerId}:${weekday}`);
    }
  }

  async addDayOff(providerId: string, date: string, actorId: string): Promise<void> {
    const r = this.record(providerId);
    if (r.daysOff.has(date)) return;
    r.daysOff.add(date);
    this.audit(actorId, 'dayoff.add', `${providerId}:${date}`);
  }

  async removeDayOff(providerId: string, date: string, actorId: string): Promise<void> {
    if (this.record(providerId).daysOff.delete(date)) {
      this.audit(actorId, 'dayoff.remove', `${providerId}:${date}`);
    }
  }
}
