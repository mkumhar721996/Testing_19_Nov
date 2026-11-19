import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { HOUR, makeBooking, makeHarness, T0 } from './fixtures.js';

function setup() {
  const h = makeHarness([
    makeBooking({ id: 'b1' }),
    makeBooking({ id: 'hourly-1', pricing: { kind: 'hourly', rateMinor: 4000, durationMinutes: 150 } }),
    makeBooking({ id: 'b3' }),
  ]);
  const app = buildApp({
    repository: h.repo,
    gateway: h.gateway,
    mailer: h.mailer,
    audit: h.audit,
    clock: h.clock,
    resolveActor: (req) => req.headers['x-user-id'] as string | undefined,
  });
  return { ...h, app };
}

const customer = { 'x-user-id': 'cust-1' };
const provider = { 'x-user-id': 'provider-1' };

async function confirm(app: ReturnType<typeof setup>['app'], id: string) {
  const res = await app.inject({ method: 'POST', url: `/bookings/${id}/confirm`, headers: provider });
  expect(res.statusCode).toBe(200);
}

describe('booking routes', () => {
  it('charges the server-computed amount and ignores client amounts (AC2, AC3)', async () => {
    const { app, gateway } = setup();
    await confirm(app, 'hourly-1');
    const res = await app.inject({
      method: 'POST',
      url: '/bookings/hourly-1/pay',
      headers: customer,
      payload: { paymentToken: 'tok_ok' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'paid' });
    expect(gateway.charges[0].amountMinor).toBe(10000);
  });

  it('returns 402 with a clear message on decline or failure and keeps the booking payable (AC5)', async () => {
    const { app, repo } = setup();
    await confirm(app, 'b1');
    const declined = await app.inject({
      method: 'POST',
      url: '/bookings/b1/pay',
      headers: customer,
      payload: { paymentToken: 'tok_decline' },
    });
    expect(declined.statusCode).toBe(402);
    expect(declined.json().error.code).toBe('payment_declined');
    expect(declined.json().error.message).toMatch(/declined/i);
    const failed = await app.inject({
      method: 'POST',
      url: '/bookings/b1/pay',
      headers: customer,
      payload: { paymentToken: 'tok_error' },
    });
    expect(failed.json().error.code).toBe('payment_failed');
    expect((await repo.find('b1'))?.status).toBe('confirmed_payment_due');
  });

  it('rejects a body carrying card details with 400 (AC11)', async () => {
    const { app, gateway } = setup();
    await confirm(app, 'b1');
    const res = await app.inject({
      method: 'POST',
      url: '/bookings/b1/pay',
      headers: customer,
      payload: { paymentToken: 'tok_ok', cardNumber: '4242424242424242' },
    });
    expect(res.statusCode).toBe(400);
    expect(gateway.charges).toHaveLength(0);
  });

  it('returns 409 when not payable and 410 past the deadline', async () => {
    const { app, clock, gateway } = setup();
    const pay = () =>
      app.inject({ method: 'POST', url: '/bookings/b1/pay', headers: customer, payload: { paymentToken: 'tok_ok' } });
    expect((await pay()).statusCode).toBe(409);
    await confirm(app, 'b1');
    clock.set(T0 + 24 * HOUR);
    expect((await pay()).statusCode).toBe(410);
    expect(gateway.charges).toHaveLength(0);
  });

  it('declined requests are shown to the customer and never charged (AC4)', async () => {
    const { app, gateway } = setup();
    const res = await app.inject({ method: 'POST', url: '/bookings/b3/decline', headers: provider });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({ method: 'GET', url: '/bookings', headers: customer });
    expect(list.json().find((b: { id: string }) => b.id === 'b3').status).toBe('declined');
    expect(gateway.charges).toHaveLength(0);
  });

  it('lists overdue bookings as cancelled even between sweeps (AC10)', async () => {
    const { app, clock, mailer } = setup();
    await confirm(app, 'b1');
    clock.set(T0 + 24 * HOUR);
    const res = await app.inject({ method: 'GET', url: '/bookings', headers: customer });
    const b1 = res.json().find((b: { id: string }) => b.id === 'b1');
    expect(b1.status).toBe('cancelled');
    expect(b1.cancelReason).toBe('payment_timeout');
    expect(b1.cancelledAt).toBe(new Date(T0 + 24 * HOUR).toISOString());
    expect(mailer.sent).toHaveLength(1);
  });

  it('lists only the signed-in customer\'s bookings and requires sign-in', async () => {
    const { app } = setup();
    const other = await app.inject({ method: 'GET', url: '/bookings', headers: { 'x-user-id': 'cust-2' } });
    expect(other.json()).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/bookings' })).statusCode).toBe(401);
  });
});
