import { describe, expect, it } from 'vitest';
import { computeAmountDueMinor } from '../../src/payments/money.js';

describe('computeAmountDueMinor', () => {
  it('charges the fixed price as shown at booking (AC2)', () => {
    expect(computeAmountDueMinor({ kind: 'fixed', priceMinor: 12000 })).toBe(12000);
  });

  it('charges hourly rate times duration (AC3)', () => {
    expect(computeAmountDueMinor({ kind: 'hourly', rateMinor: 4000, durationMinutes: 150 })).toBe(10000);
  });

  it('rounds half up to the cent', () => {
    expect(computeAmountDueMinor({ kind: 'hourly', rateMinor: 3333, durationMinutes: 45 })).toBe(2500);
    expect(computeAmountDueMinor({ kind: 'hourly', rateMinor: 1, durationMinutes: 30 })).toBe(1);
  });
});
