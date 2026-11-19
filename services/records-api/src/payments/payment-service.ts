import { computeAmountDueMinor } from './money.js';
import type {
  AuditLog,
  Booking,
  BookingRepository,
  BookingStatus,
  Clock,
  Mailer,
  PaymentGateway,
} from './types.js';

export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type PaymentErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'not_payable'
  | 'deadline_passed'
  | 'payment_declined'
  | 'payment_failed';

export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface PaymentServiceDeps {
  repository: BookingRepository;
  gateway: PaymentGateway;
  mailer: Mailer;
  audit: AuditLog;
  clock: Clock;
}

export class PaymentService {
  constructor(private readonly deps: PaymentServiceDeps) {}

  /** Fixes the amount and starts the 24-hour payment window; no charge is made here. */
  async confirmBooking(id: string, providerId: string): Promise<Booking> {
    const booking = await this.load(id);
    if (booking.providerId !== providerId) throw new PaymentError('forbidden', 'Only the booking provider can confirm it.');
    const confirmedAt = this.deps.clock.now();
    return this.transition(booking, 'requested', providerId, 'booking_confirmed', {
      status: 'confirmed_payment_due',
      confirmedAt,
      payBy: new Date(confirmedAt.getTime() + PAYMENT_WINDOW_MS),
      amountDueMinor: computeAmountDueMinor(booking.pricing),
    });
  }

  async declineBooking(id: string, providerId: string): Promise<Booking> {
    const booking = await this.load(id);
    if (booking.providerId !== providerId) throw new PaymentError('forbidden', 'Only the booking provider can decline it.');
    return this.transition(booking, 'requested', providerId, 'booking_declined', { status: 'declined' });
  }

  async expireRequest(id: string): Promise<Booking> {
    const booking = await this.load(id);
    return this.transition(booking, 'requested', 'system', 'booking_expired', { status: 'expired' });
  }

  async payBooking(id: string, customerId: string, paymentToken: string): Promise<Booking> {
    const booking = await this.load(id);
    if (booking.customerId !== customerId) throw new PaymentError('not_found', 'Booking not found.');
    if (booking.status !== 'confirmed_payment_due' || !booking.payBy) {
      throw new PaymentError('not_payable', 'This booking is not waiting for payment.');
    }
    if (this.deps.clock.now() >= booking.payBy) {
      throw new PaymentError('deadline_passed', 'The 24-hour payment window for this booking has passed.');
    }

    // Claim the booking first so the sweeper cannot cancel it while the charge is in flight.
    const claimed = await this.transition(booking, 'confirmed_payment_due', customerId, 'payment_started', {
      status: 'payment_in_progress',
    });
    const result = await this.deps.gateway.charge({
      amountMinor: computeAmountDueMinor(booking.pricing),
      currency: booking.currency,
      paymentToken,
      idempotencyKey: booking.id,
    });

    if (result.status === 'succeeded') {
      return this.transition(claimed, 'payment_in_progress', customerId, 'payment_succeeded', {
        status: 'paid',
        chargeId: result.chargeId,
      });
    }
    await this.transition(claimed, 'payment_in_progress', customerId, `payment_${result.status}`, {
      status: 'confirmed_payment_due',
    });
    throw result.status === 'declined'
      ? new PaymentError(
          'payment_declined',
          'Your payment was declined. Check your card details or try another payment method.',
        )
      : new PaymentError(
          'payment_failed',
          'Your payment could not be completed. Try again or use another payment method.',
        );
  }

  /** Cancels every confirmed booking still unpaid at its deadline (inclusive) and emails the customer once. */
  async cancelUnpaidBookings(now: Date): Promise<Booking[]> {
    const overdue = (await this.deps.repository.listByStatus('confirmed_payment_due')).filter(
      (b) => b.payBy !== undefined && now >= b.payBy,
    );
    const cancelled: Booking[] = [];
    for (const booking of overdue) {
      const saved = await this.saveIfStatus(booking, 'confirmed_payment_due', 'system', 'booking_cancelled_unpaid', {
        status: 'cancelled',
        cancelReason: 'payment_timeout',
        cancelledAt: now,
      });
      if (!saved) continue; // a payment claimed it first
      cancelled.push(saved);
      await this.deps.mailer.sendBookingCancelledForUnpaid(saved.customerEmail, saved);
    }
    return cancelled;
  }

  private async load(id: string): Promise<Booking> {
    const booking = await this.deps.repository.find(id);
    if (!booking) throw new PaymentError('not_found', 'Booking not found.');
    return booking;
  }

  private async transition(
    booking: Booking,
    from: BookingStatus,
    actor: string,
    action: string,
    changes: Partial<Booking>,
  ): Promise<Booking> {
    const saved = await this.saveIfStatus(booking, from, actor, action, changes);
    if (!saved) throw new PaymentError('not_payable', 'The booking changed state; reload and try again.');
    return saved;
  }

  private async saveIfStatus(
    booking: Booking,
    from: BookingStatus,
    actor: string,
    action: string,
    changes: Partial<Booking>,
  ): Promise<Booking | undefined> {
    const next = { ...booking, ...changes };
    if (!(await this.deps.repository.save(next, from))) return undefined;
    await this.deps.audit.record({ actor, action, bookingId: booking.id, at: this.deps.clock.now() });
    return next;
  }
}
