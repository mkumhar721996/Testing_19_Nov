import type { Pricing } from './money.js';

export type BookingStatus =
  | 'requested'
  | 'confirmed_payment_due'
  | 'payment_in_progress'
  | 'paid'
  | 'declined'
  | 'expired'
  | 'cancelled';

export interface Booking {
  id: string;
  customerId: string;
  customerEmail: string;
  providerId: string;
  serviceName: string;
  providerName: string;
  status: BookingStatus;
  pricing: Pricing;
  currency: string;
  confirmedAt?: Date;
  payBy?: Date;
  amountDueMinor?: number;
  chargeId?: string;
  cancelReason?: 'payment_timeout';
  cancelledAt?: Date;
}

export type ChargeRequest = {
  amountMinor: number;
  currency: string;
  paymentToken: string;
  idempotencyKey: string;
};

export type ChargeResult =
  | { status: 'succeeded'; chargeId: string }
  | { status: 'declined' | 'failed'; reason: string };

/** Port for the payment service (not chosen yet); only ever sees an opaque token, never card details. */
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

export interface Mailer {
  sendBookingCancelledForUnpaid(to: string, booking: Booking): Promise<void>;
}

export interface BookingRepository {
  find(id: string): Promise<Booking | undefined>;
  listByCustomer(customerId: string): Promise<Booking[]>;
  listByStatus(status: BookingStatus): Promise<Booking[]>;
  /** Saves `booking` only if the stored status is still `expectedStatus`; returns whether it was saved. */
  save(booking: Booking, expectedStatus: BookingStatus): Promise<boolean>;
}

export interface AuditEntry {
  actor: string;
  action: string;
  bookingId: string;
  at: Date;
}

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

export interface Clock {
  now(): Date;
}
