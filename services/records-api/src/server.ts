import type { FastifyRequest } from 'fastify';
import { buildApp, type AppDeps } from './app.js';
import { InMemoryAvailabilityStore } from './availability/memoryStore.js';
import { PgAvailabilityStore } from './availability/pgStore.js';
import type { Principal, ServiceCatalogPort } from './availability/types.js';
import { createPool } from './db/pool.js';
import { startUnpaidBookingSweeper } from './jobs/unpaid-booking-sweeper.js';
import { systemClock } from './payments/clock.js';
import { createEntraIdentityProvider } from './auth/entra-identity-provider.js';
import { fakeIdentityProvider } from './auth/fake-identity-provider.js';
import { createPgUserRepository } from './auth/pg-user-repository.js';
import { createSessionService } from './auth/session.js';
import { loadConfig } from './config.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8011);
const sweepIntervalMs = Number(process.env.UNPAID_SWEEP_INTERVAL_MS ?? 60_000);

function selectStore(): AppDeps['store'] {
  if (process.env.RECORDS_STORE === 'memory') return new InMemoryAvailabilityStore();
  if (process.env.DATABASE_URL) return new PgAvailabilityStore(createPool(process.env.DATABASE_URL));
  console.error('DATABASE_URL is not set. Set it, or set RECORDS_STORE=memory for local test runs.');
  process.exit(1);
}

// Entra ID token verification (ADR-0004) belongs to Accounts & Access; until it exists nobody is signed in.
async function authenticate(req: FastifyRequest): Promise<Principal | null> {
  if (process.env.NODE_ENV === 'test') {
    const id = req.headers['x-test-provider'];
    if (typeof id === 'string' && id) return { providerId: id, actorId: id };
  }
  return null;
}

// Service Catalog is not built yet; test runs offer a fixed 60-minute service.
const catalog: ServiceCatalogPort = {
  getDurationMinutes: async () => (process.env.NODE_ENV === 'test' ? 60 : null),
};

// Role sign-in needs a database for accounts; it is wired only when DATABASE_URL is set.
function selectAuth(): AppDeps['auth'] | undefined {
  if (!process.env.DATABASE_URL) return undefined;
  const config = loadConfig();
  return {
    identity: config.entra ? createEntraIdentityProvider(config.entra) : fakeIdentityProvider,
    users: createPgUserRepository(createPool(config.databaseUrl)),
    sessions: createSessionService({ secret: config.sessionSecret, ttlSeconds: config.sessionTtlSeconds }),
  };
}

const app = buildApp({ store: selectStore(), catalog, authenticate, auth: selectAuth() });
app
  .listen({ host, port })
  .then(() => {
    const stop = startUnpaidBookingSweeper(app.paymentService, systemClock, sweepIntervalMs, (err) =>
      app.log.error(err),
    );
    app.addHook('onClose', async () => stop());
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
