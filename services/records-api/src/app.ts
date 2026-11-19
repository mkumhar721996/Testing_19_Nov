import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import type { AvailabilityStore, Principal, ServiceCatalogPort } from './availability/types.js';
import { InMemoryAuditLog } from './payments/audit.js';
import { InMemoryBookingRepository } from './payments/booking-repository.js';
import { systemClock } from './payments/clock.js';
import { StubPaymentGateway } from './payments/gateway.js';
import { LoggingMailer, SesMailer } from './payments/mailer.js';
import { PaymentService } from './payments/payment-service.js';
import type { AuditLog, BookingRepository, Clock, Mailer, PaymentGateway } from './payments/types.js';
import { availabilityRoutes } from './routes/availability.js';
import { bookingRoutes } from './routes/bookings.js';
import { authRoutes, type AuthDeps } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { slotsRoutes } from './routes/slots.js';

export interface AppDeps {
  gateway: PaymentGateway;
  mailer: Mailer;
  repository: BookingRepository;
  audit: AuditLog;
  clock: Clock;
  resolveActor: (request: FastifyRequest) => string | undefined;
  store: AvailabilityStore;
  catalog: ServiceCatalogPort;
  authenticate: (req: FastifyRequest) => Promise<Principal | null>;
  /** Role sign-in; the /auth/sign-in and /me routes are registered only when provided. */
  auth: AuthDeps;
}

// Placeholder until Entra ID sign-in is wired (ADR-0004): the user id comes from a header.
// The header is client-controlled, so it is honoured only in development and test; anywhere
// else no actor resolves (401) until a verified resolver is injected.
const headerActor = (request: FastifyRequest) => {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') return undefined;
  const value = request.headers['x-user-id'];
  return typeof value === 'string' && value ? value : undefined;
};

export function buildApp(deps: Partial<AppDeps> = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    // Keep extra body properties so a schema with additionalProperties: false rejects them (400).
    ajv: { customOptions: { removeAdditional: false } },
  });
  const repository = deps.repository ?? new InMemoryBookingRepository();
  const clock = deps.clock ?? systemClock;
  const fromAddress = process.env.SES_FROM_ADDRESS;
  const mailer =
    deps.mailer ??
    (fromAddress
      ? new SesMailer(fromAddress, process.env.AWS_REGION)
      : new LoggingMailer((message) => app.log.info(message)));
  const service = new PaymentService({
    repository,
    gateway: deps.gateway ?? new StubPaymentGateway(),
    mailer,
    audit: deps.audit ?? new InMemoryAuditLog(),
    clock,
  });

  app.decorate('paymentService', service);
  app.register(healthRoutes);
  app.register(bookingRoutes, {
    service,
    repository,
    clock,
    resolveActor: deps.resolveActor ?? headerActor,
  });
  const { store, catalog, authenticate } = deps;
  if (store && authenticate) app.register(availabilityRoutes({ store, authenticate }));
  if (store && catalog) app.register(slotsRoutes({ store, catalog }));
  if (deps.auth) app.register(authRoutes(deps.auth));
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    paymentService: PaymentService;
  }
}
