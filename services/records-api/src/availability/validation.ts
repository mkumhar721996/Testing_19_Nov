const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type HoursValidation = { ok: true } | { ok: false; errors: { start?: string; end?: string } };

export function validateHours(start: unknown, end: unknown): HoursValidation {
  const errors: { start?: string; end?: string } = {};
  if (typeof start !== 'string' || !TIME.test(start)) errors.start = 'Enter a start time in the format HH:MM.';
  if (typeof end !== 'string' || !TIME.test(end)) errors.end = 'Enter an end time in the format HH:MM.';
  if (!errors.start && !errors.end && (end as string) <= (start as string)) {
    errors.end = `End time must be after the start time. Enter a time later than ${start as string}.`;
  }
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
