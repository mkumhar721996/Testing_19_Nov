export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface WorkingHours {
  weekday: Weekday;
  start: string;
  end: string;
}
export interface Slot {
  start: string;
  end: string;
  localStart: string;
  localEnd: string;
}

const MINUTE_MS = 60_000;

export function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}

function zoneParts(instant: number, timeZone: string): Record<string, number> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(new Date(instant))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts;
}

function offsetMs(instant: number, timeZone: string): number {
  const p = zoneParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Converts a provider-local wall time to the UTC instant it denotes. */
export function zonedTimeToInstant(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  let instant = wallAsUtc - offsetMs(wallAsUtc, timeZone);
  instant = wallAsUtc - offsetMs(instant, timeZone);
  return new Date(instant);
}

function localTime(instant: Date, timeZone: string): string {
  const p = zoneParts(instant.getTime(), timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function computeSlots(input: {
  date: string;
  timeZone: string;
  durationMinutes: number;
  hours: WorkingHours[];
  daysOff: string[];
}): Slot[] {
  const { date, timeZone, durationMinutes, hours, daysOff } = input;
  if (daysOff.includes(date)) return [];
  const block = hours.find((h) => h.weekday === weekdayOf(date));
  if (!block || durationMinutes <= 0) return [];

  const closing = zonedTimeToInstant(date, block.end, timeZone).getTime();
  const slots: Slot[] = [];
  let start = zonedTimeToInstant(date, block.start, timeZone).getTime();
  for (;;) {
    const end = start + durationMinutes * MINUTE_MS;
    if (end > closing) break;
    const s = new Date(start);
    const e = new Date(end);
    slots.push({
      start: s.toISOString(),
      end: e.toISOString(),
      localStart: localTime(s, timeZone),
      localEnd: localTime(e, timeZone),
    });
    start = end;
  }
  return slots;
}
