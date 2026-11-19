import type { Booking, BookingRepository, BookingStatus } from './types.js';

/** In-memory stand-in; the PostgreSQL adapter follows with the Booking & Scheduling schema. */
export class InMemoryBookingRepository implements BookingRepository {
  private readonly bookings = new Map<string, Booking>();

  constructor(seed: Booking[] = []) {
    for (const b of seed) this.bookings.set(b.id, { ...b });
  }

  async find(id: string): Promise<Booking | undefined> {
    const b = this.bookings.get(id);
    return b && { ...b };
  }

  async listByCustomer(customerId: string): Promise<Booking[]> {
    return [...this.bookings.values()].filter((b) => b.customerId === customerId).map((b) => ({ ...b }));
  }

  async listByStatus(status: BookingStatus): Promise<Booking[]> {
    return [...this.bookings.values()].filter((b) => b.status === status).map((b) => ({ ...b }));
  }

  async save(booking: Booking, expectedStatus: BookingStatus): Promise<boolean> {
    const current = this.bookings.get(booking.id);
    if (!current || current.status !== expectedStatus) return false;
    this.bookings.set(booking.id, { ...booking });
    return true;
  }
}
