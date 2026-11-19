export type Pricing =
  | { kind: 'fixed'; priceMinor: number }
  | { kind: 'hourly'; rateMinor: number; durationMinutes: number };

/** Amount to charge in integer minor units (cents); hourly rounds half up. */
export function computeAmountDueMinor(pricing: Pricing): number {
  if (pricing.kind === 'fixed') return pricing.priceMinor;
  return Math.floor((pricing.rateMinor * pricing.durationMinutes + 30) / 60);
}
