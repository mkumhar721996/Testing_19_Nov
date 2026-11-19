import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Weekday } from '../availability/slots.js';
import type { AvailabilityStore, Principal } from '../availability/types.js';
import { isValidDate, isValidTimeZone, validateHours } from '../availability/validation.js';

export interface AvailabilityRouteDeps {
  store: AvailabilityStore;
  authenticate: (req: FastifyRequest) => Promise<Principal | null>;
}

function parseWeekday(value: unknown): Weekday | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? (n as Weekday) : null;
}

export const availabilityRoutes =
  (deps: AvailabilityRouteDeps): FastifyPluginAsync =>
  async (app) => {
    const { store, authenticate } = deps;

    async function principal(req: FastifyRequest, reply: FastifyReply): Promise<Principal | null> {
      const p = await authenticate(req);
      if (!p) await reply.code(401).send({ error: 'unauthenticated' });
      return p;
    }

    const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;

    app.get('/providers/me/availability', async (req, reply) => {
      const p = await principal(req, reply);
      if (!p) return reply;
      const a = await store.getAvailability(p.providerId, p.actorId);
      return { providerId: p.providerId, timeZone: a.timeZone, hours: a.hours, daysOff: a.daysOff };
    });

    app.put('/providers/me/availability/time-zone', async (req, reply) => {
      const p = await principal(req, reply);
      if (!p) return reply;
      const { timeZone } = body(req);
      if (!isValidTimeZone(timeZone)) return reply.code(400).send({ errors: { timeZone: 'Enter a valid time zone, for example Europe/London.' } });
      await store.setTimeZone(p.providerId, timeZone, p.actorId);
      return reply.code(204).send();
    });

    app.post('/providers/me/availability/hours', async (req, reply) => {
      const p = await principal(req, reply);
      if (!p) return reply;
      const { weekday, start, end } = body(req);
      const day = parseWeekday(weekday);
      if (!day) return reply.code(400).send({ errors: { weekday: 'Choose a weekday from Monday to Sunday.' } });
      const v = validateHours(start, end);
      if (!v.ok) return reply.code(400).send({ errors: v.errors });
      const result = await store.createHours(p.providerId, { weekday: day, start: start as string, end: end as string }, p.actorId);
      if (result === 'exists') return reply.code(409).send({ error: 'hours_exist' });
      return reply.code(201).send({ weekday: day, start, end });
    });

    app.put('/providers/me/availability/hours/:weekday', async (req, reply) => {
      const p = await principal(req, reply);
      if (!p) return reply;
      const day = parseWeekday((req.params as { weekday: string }).weekday);
      if (!day) return reply.code(400).send({ errors: { weekday: 'Choose a weekday from Monday to Sunday.' } });
      const { start, end } = body(req);
      const v = validateHours(start, end);
      if (!v.ok) return reply.code(400).send({ errors: v.errors });
      const result = await store.updateHours(p.providerId, { weekday: day, start: start as string, end: end as string }, p.actorId);
      if (result === 'missing') return reply.code(404).send({ error: 'hours_missing' });
      return { weekday: day, start, end };
    });

    app.delete('/providers/me/availability/hours/:weekday', async (req, reply) => {
      const p = await principal(req, reply);
      if (!p) return reply;
      const day = parseWeekday((req.params as { weekday: string }).weekday);
      if (!day) return reply.code(400).send({ errors: { weekday: 'Choose a weekday from Monday to Sunday.' } });
      await store.deleteHours(p.providerId, day, p.actorId);
      return reply.code(204).send();
    });

    app.post('/providers/me/availability/days-off', async (req, reply) => {
      const p = await principal(req, reply);
      if (!p) return reply;
      const { date } = body(req);
      if (!isValidDate(date)) return reply.code(400).send({ errors: { date: 'Enter a date in the format YYYY-MM-DD.' } });
      await store.addDayOff(p.providerId, date, p.actorId);
      return reply.code(201).send({ date });
    });

    app.delete('/providers/me/availability/days-off/:date', async (req, reply) => {
      const p = await principal(req, reply);
      if (!p) return reply;
      const { date } = req.params as { date: string };
      if (!isValidDate(date)) return reply.code(400).send({ errors: { date: 'Enter a date in the format YYYY-MM-DD.' } });
      await store.removeDayOff(p.providerId, date, p.actorId);
      return reply.code(204).send();
    });
  };
