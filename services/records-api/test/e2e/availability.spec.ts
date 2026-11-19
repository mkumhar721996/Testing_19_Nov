import { expect, test } from '@playwright/test';

const headers = { 'x-test-provider': 'e2e-provider' };

test('provider saves availability and customers see matching slots', async ({ request }) => {
  const tz = await request.put('/providers/me/availability/time-zone', { headers, data: { timeZone: 'Europe/London' } });
  expect(tz.status()).toBe(204);

  const mon = await request.post('/providers/me/availability/hours', { headers, data: { weekday: 1, start: '09:00', end: '17:00' } });
  expect(mon.status()).toBe(201);
  const second = await request.post('/providers/me/availability/hours', { headers, data: { weekday: 1, start: '18:00', end: '20:00' } });
  expect(second.status()).toBe(409);

  const off = await request.post('/providers/me/availability/days-off', { headers, data: { date: '2027-03-12' } });
  expect(off.status()).toBe(201);

  const saved = await (await request.get('/providers/me/availability', { headers })).json();
  expect(saved.hours).toEqual([{ weekday: 1, start: '09:00', end: '17:00' }]);
  expect(saved.daysOff).toEqual(['2027-03-12']);

  const monday = await (await request.get('/providers/e2e-provider/availability/slots?date=2027-03-22&serviceId=any')).json();
  expect(monday.slots.length).toBe(8);
  const dayOff = await (await request.get('/providers/e2e-provider/availability/slots?date=2027-03-12&serviceId=any')).json();
  expect(dayOff.slots).toEqual([]);
});
