import { describe, expect, it } from 'vitest';
import { computeSlots, weekdayOf, zonedTimeToInstant, type WorkingHours } from '../../src/availability/slots.js';

const mon: WorkingHours = { weekday: 1, start: '09:00', end: '17:00' };
const base = { timeZone: 'Europe/London', durationMinutes: 60, hours: [mon], daysOff: [] as string[] };

describe('weekdayOf', () => {
  it('maps calendar dates to ISO weekdays', () => {
    expect(weekdayOf('2027-03-22')).toBe(1);
    expect(weekdayOf('2027-03-21')).toBe(7);
  });
});

describe('zonedTimeToInstant', () => {
  it('converts New York wall time in EDT', () => {
    expect(zonedTimeToInstant('2027-03-15', '09:00', 'America/New_York').toISOString()).toBe('2027-03-15T13:00:00.000Z');
  });
});

describe('computeSlots', () => {
  it('offers the Monday hours on a later Monday (AC2)', () => {
    const slots = computeSlots({ ...base, date: '2027-03-22' });
    expect(slots.map((s) => s.localStart)).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
  });

  it('returns nothing on a day off (AC4)', () => {
    const fri: WorkingHours = { weekday: 5, start: '09:00', end: '17:00' };
    expect(computeSlots({ ...base, hours: [fri], date: '2027-03-12', daysOff: ['2027-03-12'] })).toEqual([]);
  });

  it('keeps hours after a day off is removed (AC10)', () => {
    const fri: WorkingHours = { weekday: 5, start: '09:00', end: '17:00' };
    expect(computeSlots({ ...base, hours: [fri], date: '2027-03-12' }).length).toBe(8);
  });

  it('starts at the opening time and never ends after closing (AC5, AC6)', () => {
    const slots = computeSlots({ ...base, durationMinutes: 45, date: '2027-03-22' });
    expect(slots[0].localStart).toBe('09:00');
    expect(slots.every((s) => s.localStart >= '09:00' && s.localEnd <= '17:00')).toBe(true);
    expect(slots.at(-1)!.localEnd).toBe('16:30'); // the 16:30 to 17:15 candidate is dropped
  });

  it('returns nothing on a weekday without hours (AC7)', () => {
    expect(computeSlots({ ...base, date: '2027-03-16' })).toEqual([]);
  });

  it('makes every slot exactly the duration, also across DST (AC8)', () => {
    for (const [date, minutes] of [['2027-03-22', 60], ['2027-03-29', 60], ['2027-03-22', 30]] as const) {
      const slots = computeSlots({ ...base, date, durationMinutes: minutes });
      expect(slots.length).toBeGreaterThan(0);
      for (const s of slots) expect(Date.parse(s.end) - Date.parse(s.start)).toBe(minutes * 60 * 1000);
    }
  });

  it('is unaffected by a day off on the previous day (AC11)', () => {
    const fri: WorkingHours = { weekday: 5, start: '09:00', end: '17:00' };
    const sat: WorkingHours = { weekday: 6, start: '10:00', end: '14:00' };
    const b = { ...base, hours: [fri, sat], date: '2027-03-13' };
    const withDayOff = computeSlots({ ...b, daysOff: ['2027-03-12'] });
    expect(withDayOff).toEqual(computeSlots({ ...b, daysOff: [] }));
    expect(withDayOff.length).toBeGreaterThan(0);
  });

  it('uses the provider time zone (AC12)', () => {
    const ny = computeSlots({ ...base, timeZone: 'America/New_York', date: '2027-03-15' });
    expect(ny[0].start).toBe('2027-03-15T13:00:00.000Z');
    expect(ny[0].localStart).toBe('09:00');
    expect(ny.at(-1)!.localEnd).toBe('17:00');
    const london = computeSlots({ ...base, date: '2027-03-15' });
    expect(london[0].start).toBe('2027-03-15T09:00:00.000Z');
  });
});
