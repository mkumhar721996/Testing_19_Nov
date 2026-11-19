import { describe, expect, it } from 'vitest';
import { HOUR, makeBooking, makeHarness, T0 } from './fixtures.js';

const seed = () => [
  makeBooking({ id: 'b1' }),
  makeBooking({ id: 'b2' }),
  makeBooking({ id: 'b3' }),
  makeBooking({ id: 'h1', pricing: { kind: 'hourly', rateMinor: 4000, durationMinutes: 150 } }),
];

describe('PaymentService', () => {
  it('confirms, stores the 24h deadline and charges when the customer pays (AC1, AC2)', async () => {
    const { service, repo, gateway, audit } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    const confirmed = await repo.find('b1');
    expect(confirmed?.status).toBe('confirmed_payment_due');
    expect(confirmed?.amountDueMinor).toBe(12000);
    expect(confirmed?.payBy?.getTime()).toBe(T0 + 24 * HOUR);
    expect(gateway.charges).toHaveLength(0);

    await service.payBooking('b1', 'cust-1', 'tok_ok');
    expect(gateway.charges).toEqual([
      { amountMinor: 12000, currency: 'USD', paymentToken: 'tok_ok', idempotencyKey: 'b1' },
    ]);
    expect((await repo.find('b1'))?.status).toBe('paid');
    expect(audit.entries.map((e) => e.action)).toContain('payment_succeeded');
    expect(audit.entries.every((e) => e.actor && e.at)).toBe(true);
  });

  it('charges hourly rate times duration (AC3)', async () => {
    const { service, gateway } = makeHarness(seed());
    await service.confirmBooking('h1', 'provider-1');
    await service.payBooking('h1', 'cust-1', 'tok_ok');
    expect(gateway.charges[0].amountMinor).toBe(10000);
  });

  it('only the booking provider can confirm', async () => {
    const { service } = makeHarness(seed());
    await expect(service.confirmBooking('b1', 'someone-else')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('never charges declined or expired requests (AC4)', async () => {
    const { service, repo, gateway } = makeHarness(seed());
    await service.declineBooking('b2', 'provider-1');
    await service.expireRequest('b3');
    expect(gateway.charges).toHaveLength(0);
    expect((await repo.find('b2'))?.status).toBe('declined');
    expect((await repo.find('b3'))?.status).toBe('expired');
    await expect(service.payBooking('b2', 'cust-1', 'tok_ok')).rejects.toMatchObject({ code: 'not_payable' });
    expect(gateway.charges).toHaveLength(0);
  });

  it('keeps the booking confirmed and returns a clear error when payment is declined or fails (AC5)', async () => {
    const { service, repo } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    await expect(service.payBooking('b1', 'cust-1', 'tok_decline')).rejects.toMatchObject({
      code: 'payment_declined',
      message: expect.stringMatching(/declined/i),
    });
    expect((await repo.find('b1'))?.status).toBe('confirmed_payment_due');
    await expect(service.payBooking('b1', 'cust-1', 'tok_error')).rejects.toMatchObject({ code: 'payment_failed' });
    expect((await repo.find('b1'))?.status).toBe('confirmed_payment_due');
    await service.payBooking('b1', 'cust-1', 'tok_ok');
    expect((await repo.find('b1'))?.status).toBe('paid');
  });

  it('cancels at 24 hours, not before, and emails once (AC8, AC9)', async () => {
    const { service, repo, clock, mailer } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    clock.set(T0 + 24 * HOUR - 1);
    await service.cancelUnpaidBookings(clock.now());
    expect((await repo.find('b1'))?.status).toBe('confirmed_payment_due');
    expect(mailer.sent).toHaveLength(0);

    clock.set(T0 + 24 * HOUR);
    await service.cancelUnpaidBookings(clock.now());
    const b = await repo.find('b1');
    expect(b?.status).toBe('cancelled');
    expect(b?.cancelReason).toBe('payment_timeout');
    expect(mailer.sent).toEqual([{ to: 'sam@example.com', bookingId: 'b1' }]);

    await service.cancelUnpaidBookings(clock.now());
    expect(mailer.sent).toHaveLength(1);
  });

  it('never cancels a paid booking, and refuses payment after the deadline without charging', async () => {
    const { service, repo, clock, gateway, mailer } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    await service.confirmBooking('b2', 'provider-1');
    await service.payBooking('b1', 'cust-1', 'tok_ok');
    clock.set(T0 + 25 * HOUR);
    await service.cancelUnpaidBookings(clock.now());
    expect((await repo.find('b1'))?.status).toBe('paid');
    await expect(service.payBooking('b2', 'cust-1', 'tok_ok')).rejects.toMatchObject({ code: 'not_payable' });
    expect(gateway.charges).toHaveLength(1);
    expect(mailer.sent).toHaveLength(1);
  });

  it('refuses payment at the deadline instant', async () => {
    const { service, clock, gateway } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    clock.set(T0 + 24 * HOUR);
    await expect(service.payBooking('b1', 'cust-1', 'tok_ok')).rejects.toMatchObject({ code: 'deadline_passed' });
    expect(gateway.charges).toHaveLength(0);
  });

  it('releases the claim and reports payment_failed when the gateway throws', async () => {
    const { service, repo, gateway } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    gateway.charge = async () => {
      throw new Error('network down');
    };
    await expect(service.payBooking('b1', 'cust-1', 'tok_ok')).rejects.toMatchObject({ code: 'payment_failed' });
    expect((await repo.find('b1'))?.status).toBe('confirmed_payment_due');
  });

  it('keeps cancelling other bookings when one cancellation email fails, then reports the failure', async () => {
    const { service, repo, clock, mailer } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    await service.confirmBooking('b2', 'provider-1');
    const send = mailer.sendBookingCancelledForUnpaid.bind(mailer);
    mailer.sendBookingCancelledForUnpaid = async (to, booking) => {
      if (booking.id === 'b1') throw new Error('ses down');
      return send(to, booking);
    };
    clock.set(T0 + 24 * HOUR);
    await expect(service.cancelUnpaidBookings(clock.now())).rejects.toThrow();
    expect((await repo.find('b1'))?.status).toBe('cancelled');
    expect((await repo.find('b2'))?.status).toBe('cancelled');
    expect(mailer.sent).toEqual([{ to: 'sam@example.com', bookingId: 'b2' }]);
  });

  it('a sweep while a charge is in flight does not cancel the booking', async () => {
    const { service, repo, clock, gateway } = makeHarness(seed());
    await service.confirmBooking('b1', 'provider-1');
    gateway.charge = async () => {
      clock.set(T0 + 25 * HOUR);
      await service.cancelUnpaidBookings(clock.now());
      return { status: 'succeeded', chargeId: 'ch_1' };
    };
    await service.payBooking('b1', 'cust-1', 'tok_ok');
    expect((await repo.find('b1'))?.status).toBe('paid');
  });
});
