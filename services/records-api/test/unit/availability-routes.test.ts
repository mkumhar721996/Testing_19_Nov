import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { InMemoryAvailabilityStore } from '../../src/availability/memoryStore.js';

const auth = { 'x-provider': 'p1' };
let app: FastifyInstance;

beforeEach(() => {
  app = buildApp({
    store: new InMemoryAvailabilityStore(),
    catalog: { getDurationMinutes: async () => 60 },
    authenticate: async (req) => {
      const id = req.headers['x-provider'];
      return typeof id === 'string' ? { providerId: id, actorId: id } : null;
    },
  });
});
afterEach(() => app.close());

const post = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/providers/me/availability/hours', payload: payload as object, headers: auth });
const get = () => app.inject({ method: 'GET', url: '/providers/me/availability', headers: auth });

describe('provider availability routes', () => {
  it('returns 401 without a principal', async () => {
    const res = await app.inject({ method: 'GET', url: '/providers/me/availability' });
    expect(res.statusCode).toBe(401);
  });

  it('shows saved hours when reopened (AC1)', async () => {
    expect((await post({ weekday: 1, start: '09:00', end: '17:00' })).statusCode).toBe(201);
    expect((await get()).json().hours).toEqual([{ weekday: 1, start: '09:00', end: '17:00' }]);
  });

  it('updates an existing block and 404s on a missing one', async () => {
    const put = (weekday: number) =>
      app.inject({ method: 'PUT', url: `/providers/me/availability/hours/${weekday}`, payload: { start: '08:00', end: '12:00' }, headers: auth });
    expect((await put(1)).statusCode).toBe(404);
    await post({ weekday: 1, start: '09:00', end: '17:00' });
    expect((await put(1)).statusCode).toBe(200);
    expect((await get()).json().hours).toEqual([{ weekday: 1, start: '08:00', end: '12:00' }]);
  });

  it('deletes hours', async () => {
    await post({ weekday: 1, start: '09:00', end: '17:00' });
    const res = await app.inject({ method: 'DELETE', url: '/providers/me/availability/hours/1', headers: auth });
    expect(res.statusCode).toBe(204);
    expect((await get()).json().hours).toEqual([]);
  });

  it('marks and unmarks days off (AC3)', async () => {
    const add = await app.inject({ method: 'POST', url: '/providers/me/availability/days-off', payload: { date: '2027-03-12' }, headers: auth });
    expect(add.statusCode).toBe(201);
    expect((await get()).json().daysOff).toEqual(['2027-03-12']);
    await app.inject({ method: 'DELETE', url: '/providers/me/availability/days-off/2027-03-12', headers: auth });
    expect((await get()).json().daysOff).toEqual([]);
  });

  it('rejects an end not after the start on the end field (AC9)', async () => {
    const res = await post({ weekday: 1, start: '17:00', end: '09:00' });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors.end).toMatch(/End time must be after the start time/);
    expect((await post({ weekday: 1, start: '09:00', end: '09:00' })).statusCode).toBe(400);
  });

  it('rejects a second block for a weekday and keeps the original (AC13)', async () => {
    await post({ weekday: 1, start: '09:00', end: '17:00' });
    const second = await post({ weekday: 1, start: '18:00', end: '20:00' });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({ error: 'hours_exist' });
    expect((await get()).json().hours).toEqual([{ weekday: 1, start: '09:00', end: '17:00' }]);
  });

  it('validates the time zone', async () => {
    const put = (timeZone: string) =>
      app.inject({ method: 'PUT', url: '/providers/me/availability/time-zone', payload: { timeZone }, headers: auth });
    expect((await put('Nowhere/Land')).statusCode).toBe(400);
    expect((await put('Europe/London')).statusCode).toBe(204);
    expect((await get()).json().timeZone).toBe('Europe/London');
  });
});
