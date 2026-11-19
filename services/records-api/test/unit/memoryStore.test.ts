import { describe, expect, it } from 'vitest';
import { InMemoryAvailabilityStore } from '../../src/availability/memoryStore.js';

const mon = { weekday: 1 as const, start: '09:00', end: '17:00' };

describe('InMemoryAvailabilityStore', () => {
  it('never overwrites an existing block (AC13)', async () => {
    const store = new InMemoryAvailabilityStore();
    expect(await store.createHours('p1', mon, 'a')).toBe('created');
    expect(await store.createHours('p1', { ...mon, start: '18:00', end: '20:00' }, 'a')).toBe('exists');
    expect((await store.getAvailability('p1', 'a')).hours).toEqual([mon]);
  });

  it('updates only an existing block', async () => {
    const store = new InMemoryAvailabilityStore();
    expect(await store.updateHours('p1', mon, 'a')).toBe('missing');
    await store.createHours('p1', mon, 'a');
    expect(await store.updateHours('p1', { ...mon, end: '18:00' }, 'a')).toBe('updated');
  });

  it('adds and removes days off idempotently', async () => {
    const store = new InMemoryAvailabilityStore();
    await store.addDayOff('p1', '2027-03-12', 'a');
    await store.addDayOff('p1', '2027-03-12', 'a');
    expect((await store.getAvailability('p1', 'a')).daysOff).toEqual(['2027-03-12']);
    await store.removeDayOff('p1', '2027-03-12', 'a');
    expect((await store.getAvailability('p1', 'a')).daysOff).toEqual([]);
  });

  it('records an audit entry with actor and time for each write', async () => {
    const store = new InMemoryAvailabilityStore();
    await store.createHours('p1', mon, 'actor-1');
    expect(store.auditLog.at(-1)).toMatchObject({ actorId: 'actor-1', action: 'hours.create' });
    expect(store.auditLog.at(-1)!.occurredAt).toBeInstanceOf(Date);
  });
});
