import type { FastifyPluginAsync } from 'fastify';
import { computeSlots } from '../availability/slots.js';
import type { AvailabilityStore, ServiceCatalogPort } from '../availability/types.js';
import { isValidDate } from '../availability/validation.js';

export interface SlotsRouteDeps {
  store: AvailabilityStore;
  catalog: ServiceCatalogPort;
}

export const slotsRoutes =
  ({ store, catalog }: SlotsRouteDeps): FastifyPluginAsync =>
  async (app) => {
    app.get('/providers/:providerId/availability/slots', async (req, reply) => {
      const { providerId } = req.params as { providerId: string };
      const { date, serviceId } = req.query as { date?: string; serviceId?: string };
      if (!isValidDate(date)) return reply.code(400).send({ errors: { date: 'Enter a date in the format YYYY-MM-DD.' } });
      if (!serviceId) return reply.code(400).send({ errors: { serviceId: 'Choose a service.' } });

      const durationMinutes = await catalog.getDurationMinutes(providerId, serviceId);
      if (durationMinutes === null) return reply.code(404).send({ error: 'service_not_found' });

      const a = await store.getAvailability(providerId, 'customer');
      if (!a.timeZone) return { date, timeZone: null, durationMinutes, slots: [] };
      const slots = computeSlots({ date, timeZone: a.timeZone, durationMinutes, hours: a.hours, daysOff: a.daysOff });
      return { date, timeZone: a.timeZone, durationMinutes, slots };
    });
  };
