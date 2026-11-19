import type pg from 'pg';
import type { Weekday, WorkingHours } from './slots.js';
import type { AvailabilityStore, ProviderAvailability } from './types.js';

const hhmm = (t: string) => t.slice(0, 5);

export class PgAvailabilityStore implements AvailabilityStore {
  constructor(private readonly pool: pg.Pool) {}

  /** Runs the change and its audit row in one transaction (ADR-0011). */
  private async write<T>(fn: (c: pg.PoolClient) => Promise<{ result: T; audit: [string, string] | null }>, actorId: string): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const { result, audit } = await fn(client);
      if (audit) {
        await client.query('insert into audit_records (actor_id, action, subject) values ($1, $2, $3)', [actorId, audit[0], audit[1]]);
      }
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async getAvailability(providerId: string, _actorId?: string): Promise<ProviderAvailability> {
    const [tz, hours, off] = await Promise.all([
      this.pool.query('select time_zone from provider_availability where provider_id = $1', [providerId]),
      this.pool.query('select weekday, start_time, end_time from working_hours where provider_id = $1 order by weekday', [providerId]),
      this.pool.query("select to_char(day, 'YYYY-MM-DD') as day from days_off where provider_id = $1 order by day", [providerId]),
    ]);
    return {
      timeZone: tz.rows[0]?.time_zone ?? null,
      hours: hours.rows.map((r) => ({ weekday: Number(r.weekday) as Weekday, start: hhmm(r.start_time), end: hhmm(r.end_time) })),
      daysOff: off.rows.map((r) => r.day as string),
    };
  }

  private static ensureProvider(c: pg.PoolClient, providerId: string, timeZone = 'UTC') {
    return c.query('insert into provider_availability (provider_id, time_zone) values ($1, $2) on conflict (provider_id) do nothing', [providerId, timeZone]);
  }

  setTimeZone(providerId: string, timeZone: string, actorId: string): Promise<void> {
    return this.write(async (c) => {
      await c.query(
        `insert into provider_availability (provider_id, time_zone) values ($1, $2)
         on conflict (provider_id) do update set time_zone = excluded.time_zone, updated_at = now()`,
        [providerId, timeZone],
      );
      return { result: undefined, audit: ['timezone.set', `${providerId}:${timeZone}`] };
    }, actorId);
  }

  createHours(providerId: string, h: WorkingHours, actorId: string): Promise<'created' | 'exists'> {
    return this.write(async (c) => {
      await PgAvailabilityStore.ensureProvider(c, providerId);
      const res = await c.query(
        'insert into working_hours (provider_id, weekday, start_time, end_time) values ($1, $2, $3, $4) on conflict (provider_id, weekday) do nothing',
        [providerId, h.weekday, h.start, h.end],
      );
      return res.rowCount
        ? { result: 'created' as const, audit: ['hours.create', `${providerId}:${h.weekday}`] as [string, string] }
        : { result: 'exists' as const, audit: null };
    }, actorId);
  }

  updateHours(providerId: string, h: WorkingHours, actorId: string): Promise<'updated' | 'missing'> {
    return this.write(async (c) => {
      const res = await c.query('update working_hours set start_time = $3, end_time = $4 where provider_id = $1 and weekday = $2', [
        providerId,
        h.weekday,
        h.start,
        h.end,
      ]);
      return res.rowCount
        ? { result: 'updated' as const, audit: ['hours.update', `${providerId}:${h.weekday}`] as [string, string] }
        : { result: 'missing' as const, audit: null };
    }, actorId);
  }

  deleteHours(providerId: string, weekday: Weekday, actorId: string): Promise<void> {
    return this.write(async (c) => {
      const res = await c.query('delete from working_hours where provider_id = $1 and weekday = $2', [providerId, weekday]);
      return { result: undefined, audit: res.rowCount ? ['hours.delete', `${providerId}:${weekday}`] : null };
    }, actorId);
  }

  addDayOff(providerId: string, date: string, actorId: string): Promise<void> {
    return this.write(async (c) => {
      await PgAvailabilityStore.ensureProvider(c, providerId);
      const res = await c.query('insert into days_off (provider_id, day) values ($1, $2) on conflict do nothing', [providerId, date]);
      return { result: undefined, audit: res.rowCount ? ['dayoff.add', `${providerId}:${date}`] : null };
    }, actorId);
  }

  removeDayOff(providerId: string, date: string, actorId: string): Promise<void> {
    return this.write(async (c) => {
      const res = await c.query('delete from days_off where provider_id = $1 and day = $2', [providerId, date]);
      return { result: undefined, audit: res.rowCount ? ['dayoff.remove', `${providerId}:${date}`] : null };
    }, actorId);
  }
}
