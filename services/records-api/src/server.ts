import { buildApp } from './app.js';
import { createProfileStore } from './profiles/store.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8011);

const store = createProfileStore();
// Dev-only seed: no-op unless SEED_PROVIDER is set. Providers are created in memory only.
if (process.env.SEED_PROVIDER) {
  store.seed({ id: process.env.SEED_PROVIDER, displayName: 'Seed provider' });
}

const app = buildApp({ store });
app.listen({ host, port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
