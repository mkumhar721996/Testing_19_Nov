import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { computeAmountDueMinor } from '../payments/money.js';
import { PaymentError, type PaymentService } from '../payments/payment-service.js';
import type { Booking, Clock } from '../payments/types.js';

export interface BookingRoutesOptions {
  service: PaymentService;
  repository: { listByCustomer(customerId: string): Promise<Booking[]> };
  clock: Clock;
  /** Returns the signed-in user's id; the seam where Entra ID sign-in plugs in. */
  resolveActor: (request: FastifyRequest) => string | undefined;
}

const HTTP_STATUS: Record<PaymentError['code'], number> = {
  not_found: 404,
  forbidden: 403,
  not_payable: 409,
  deadline_passed: 410,
  payment_declined: 402,
  payment_failed: 402,
};

function toResponse(booking: Booking) {
  return {
    id: booking.id,
    serviceName: booking.serviceName,
    providerName: booking.providerName,
    // A charge in flight still reads as payment due to the customer.
    status: booking.status === 'payment_in_progress' ? 'confirmed_payment_due' : booking.status,
    pricing: booking.pricing,
    amountDueMinor: booking.amountDueMinor ?? computeAmountDueMinor(booking.pricing),
    currency: booking.currency,
    payBy: booking.payBy?.toISOString() ?? null,
    cancelReason: booking.cancelReason ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
  };
}

export const bookingRoutes: FastifyPluginAsync<BookingRoutesOptions> = async (app, opts) => {
  const { service, repository, clock, resolveActor } = opts;

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof PaymentError) {
      return reply.code(HTTP_STATUS[error.code]).send({ error: { code: error.code, message: error.message } });
    }
    return reply.send(error);
  });

  function actorOrReject(request: FastifyRequest, reply: FastifyReply): string | undefined {
    const actor = resolveActor(request);
    if (!actor) {
      reply.code(401).send({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } });
    }
    return actor;
  }

  app.get('/bookings', async (request, reply) => {
    const actor = actorOrReject(request, reply);
    if (!actor) return reply;
    // A failed cancellation email must not break the listing; the sweep already cancelled the bookings.
    await service.cancelUnpaidBookings(clock.now()).catch((error) => request.log.error(error));
    return (await repository.listByCustomer(actor)).map(toResponse);
  });

  app.post<{ Params: { id: string } }>('/bookings/:id/confirm', async (request, reply) => {
    const actor = actorOrReject(request, reply);
    if (!actor) return reply;
    return toResponse(await service.confirmBooking(request.params.id, actor));
  });

  app.post<{ Params: { id: string } }>('/bookings/:id/decline', async (request, reply) => {
    const actor = actorOrReject(request, reply);
    if (!actor) return reply;
    return toResponse(await service.declineBooking(request.params.id, actor));
  });

  app.post<{ Params: { id: string }; Body: { paymentToken: string } }>(
    '/bookings/:id/pay',
    {
      schema: {
        body: {
          type: 'object',
          required: ['paymentToken'],
          additionalProperties: false,
          properties: { paymentToken: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const actor = actorOrReject(request, reply);
      if (!actor) return reply;
      await service.payBooking(request.params.id, actor, request.body.paymentToken);
      return { status: 'paid' };
    },
  );
};
