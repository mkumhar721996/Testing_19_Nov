import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { InMemoryAvailabilityStore } from '../../src/availability/memoryStore.js';

let app: FastifyInstance;
let store: InMemoryAvailabilityStore;

beforeEach(async () => {
  store = new InMemoryAvailabilityStore();
  app = buildApp({
    store,
    catalog: { getDurationMinutes: async (_p, s) => (s === 's1' ? 60 : null) },
    authenticate: async () => null,
  });
  await store.setTimeZone('p1', 'Europe/London', 'p1');
  await store.createHours('p1', { weekday: 1, start: '09:00', end: '17:00' }, 'p1');
  await store.createHours('p1', { weekday: 5, start: '09:00', end: '17:00' }, 'p1');
});
afterEach(() => app.close());

const slots = (date: string, headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url: `/providers/p1/availability/slots?date=${date}&serviceId=s1`, headers });

describe('GET /providers/:providerId/availability/slots', () => {
  it('offers the Monday hours on a later Monday (AC2)', async () => {
    const res = await slots('2027-03-22');
    expect(res.json().slots.map((s: { localStart: string }) => s.localStart)).toHaveLength(8);
    expect(res.json()).toMatchObject({ date: '2027-03-22', timeZone: 'Europe/London', durationMinutes: 60 });
  });

  it('offers nothing on a day off (AC4)', async () => {
    await store.addDayOff('p1', '2027-03-12', 'p1');
    expect((await slots('2027-03-12')).json().slots).toEqual([]);
  });

  it('offers nothing on a weekday without hours (AC7)', async () => {
    expect((await slots('2027-03-16')).json().slots).toEqual([]);
  });

  it('offers the working hours again once the day off is removed (AC10)', async () => {
    await store.addDayOff('p1', '2027-03-12', 'p1');
    await store.removeDayOff('p1', '2027-03-12', 'p1');
    const body = (await slots('2027-03-12')).json();
    expect(body.slots.length).toBeGreaterThan(0);
    expect(body.slots.every((s: { localStart: string; localEnd: string }) => s.localStart >= '09:00' && s.localEnd <= '17:00')).toBe(true);
  });

  it('does not depend on caller headers (AC12)', async () => {
    const plain = (await slots('2027-03-22')).json();
    const other = (await slots('2027-03-22', { 'accept-language': 'ja-JP', 'time-zone': 'Asia/Tokyo' })).json();
    expect(other).toEqual(plain);
  });

  it('returns no slots for a provider without a time zone', async () => {
    const res = await app.inject({ method: 'GET', url: '/providers/p2/availability/slots?date=2027-03-22&serviceId=s1' });
    expect(res.json().slots).toEqual([]);
  });

  it('rejects a bad date and an unknown service', async () => {
    expect((await slots('nope')).statusCode).toBe(400);
    const res = await app.inject({ method: 'GET', url: '/providers/p1/availability/slots?date=2027-03-22&serviceId=zzz' });
    expect(res.statusCode).toBe(404);
  });
});
