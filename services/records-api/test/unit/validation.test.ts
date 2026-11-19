import { describe, expect, it } from 'vitest';
import { isValidDate, isValidTimeZone, validateHours } from '../../src/availability/validation.js';

describe('validateHours', () => {
  it('accepts a start before an end', () => {
    expect(validateHours('09:00', '17:00')).toEqual({ ok: true });
  });

  it('rejects an end before the start with the end-time message (AC9)', () => {
    expect(validateHours('17:00', '09:00')).toEqual({
      ok: false,
      errors: { end: 'End time must be after the start time. Enter a time later than 17:00.' },
    });
  });

  it('rejects an end equal to the start', () => {
    expect(validateHours('09:00', '09:00').ok).toBe(false);
  });

  it('rejects malformed times', () => {
    expect(validateHours('9am', '25:00')).toMatchObject({ ok: false, errors: { start: expect.any(String), end: expect.any(String) } });
  });
});

describe('isValidDate / isValidTimeZone', () => {
  it('checks calendar dates and IANA zones', () => {
    expect(isValidDate('2027-03-12')).toBe(true);
    expect(isValidDate('2027-02-30')).toBe(false);
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Mars/Base')).toBe(false);
  });
});
