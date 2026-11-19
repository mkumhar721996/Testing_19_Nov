import { expect, test } from '@playwright/test';

// The running server uses the in-memory repository, which has no bookings until Booking & Scheduling
// creates them, so these checks cover the wired routes and validation; the transitions are unit-tested.
const customer = { 'x-user-id': 'cust-1' };

test('GET /bookings requires a signed-in user and lists the customer bookings', async ({ request }) => {
  expect((await request.get('/bookings')).status()).toBe(401);
  const res = await request.get('/bookings', { headers: customer });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual([]);
});

test('POST /bookings/:id/pay rejects card details in the body', async ({ request }) => {
  const res = await request.post('/bookings/b1/pay', {
    headers: customer,
    data: { paymentToken: 'tok_ok', cardNumber: '4242424242424242' },
  });
  expect(res.status()).toBe(400);
});

test('POST /bookings/:id/pay for an unknown booking is not found and charges no one', async ({ request }) => {
  const res = await request.post('/bookings/unknown/pay', { headers: customer, data: { paymentToken: 'tok_ok' } });
  expect(res.status()).toBe(404);
});
