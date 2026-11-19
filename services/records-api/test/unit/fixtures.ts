import { InMemoryAuditLog } from '../../src/payments/audit.js';
import { InMemoryBookingRepository } from '../../src/payments/booking-repository.js';
import { StubPaymentGateway } from '../../src/payments/gateway.js';
import { FakeMailer } from '../../src/payments/mailer.js';
import { PaymentService } from '../../src/payments/payment-service.js';
import type { Booking, Clock } from '../../src/payments/types.js';

export class FakeClock implements Clock {
  constructor(private ms: number) {}
  now(): Date {
    return new Date(this.ms);
  }
  set(ms: number): void {
    this.ms = ms;
  }
}

export const HOUR = 3600_000;
export const T0 = Date.UTC(2026, 10, 19, 9, 0, 0);

export function makeBooking(overrides: Partial<Booking> & { id: string }): Booking {
  return {
    customerId: 'cust-1',
    customerEmail: 'sam@example.com',
    providerId: 'provider-1',
    serviceName: 'Deep clean',
    providerName: 'Maya R.',
    status: 'requested',
    pricing: { kind: 'fixed', priceMinor: 12000 },
    currency: 'USD',
    ...overrides,
  };
}

export function makeHarness(bookings: Booking[], startMs = T0) {
  const repo = new InMemoryBookingRepository(bookings);
  const gateway = new StubPaymentGateway();
  const mailer = new FakeMailer();
  const audit = new InMemoryAuditLog();
  const clock = new FakeClock(startMs);
  const service = new PaymentService({ repository: repo, gateway, mailer, audit, clock });
  return { repo, gateway, mailer, audit, clock, service };
}
