import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startUnpaidBookingSweeper } from '../../src/jobs/unpaid-booking-sweeper.js';
import { HOUR, makeBooking, makeHarness, T0 } from './fixtures.js';

describe('startUnpaidBookingSweeper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cancels overdue bookings on each tick until stopped (AC8)', async () => {
    const h = makeHarness([makeBooking({ id: 'b1' }), makeBooking({ id: 'b2' })]);
    await h.service.confirmBooking('b1', 'provider-1');
    const stop = startUnpaidBookingSweeper(h.service, h.clock, 1000);

    await vi.advanceTimersByTimeAsync(1000);
    expect((await h.repo.find('b1'))?.status).toBe('confirmed_payment_due');

    h.clock.set(T0 + 24 * HOUR);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await h.repo.find('b1'))?.status).toBe('cancelled');
    expect(h.mailer.sent).toHaveLength(1);

    stop();
    await h.service.confirmBooking('b2', 'provider-1');
    h.clock.set(T0 + 50 * HOUR);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await h.repo.find('b2'))?.status).toBe('confirmed_payment_due');
  });
});
