import { buildApp } from './app.js';
import { createEntraIdentityProvider } from './auth/entra-identity-provider.js';
import { fakeIdentityProvider } from './auth/fake-identity-provider.js';
import { createPgUserRepository } from './auth/pg-user-repository.js';
import { createSessionService } from './auth/session.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8011);

const config = loadConfig();
const identity = config.entra ? createEntraIdentityProvider(config.entra) : fakeIdentityProvider;
const app = buildApp({
  identity,
  users: createPgUserRepository(createPool(config.databaseUrl)),
  sessions: createSessionService({ secret: config.sessionSecret, ttlSeconds: config.sessionTtlSeconds }),
});
app.listen({ host, port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
