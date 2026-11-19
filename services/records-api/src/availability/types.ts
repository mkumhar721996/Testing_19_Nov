import type { Weekday, WorkingHours } from './slots.js';

export interface ProviderAvailability {
  timeZone: string | null;
  hours: WorkingHours[];
  daysOff: string[];
}

export interface AvailabilityStore {
  getAvailability(providerId: string, actorId: string): Promise<ProviderAvailability>;
  setTimeZone(providerId: string, timeZone: string, actorId: string): Promise<void>;
  /** Never overwrites an existing block for the weekday. */
  createHours(providerId: string, h: WorkingHours, actorId: string): Promise<'created' | 'exists'>;
  updateHours(providerId: string, h: WorkingHours, actorId: string): Promise<'updated' | 'missing'>;
  deleteHours(providerId: string, weekday: Weekday, actorId: string): Promise<void>;
  /** Idempotent. */
  addDayOff(providerId: string, date: string, actorId: string): Promise<void>;
  removeDayOff(providerId: string, date: string, actorId: string): Promise<void>;
}

/** Service Catalog boundary: the duration of a provider's service, or null if unknown. */
export interface ServiceCatalogPort {
  getDurationMinutes(providerId: string, serviceId: string): Promise<number | null>;
}

export interface Principal {
  providerId: string;
  actorId: string;
}
