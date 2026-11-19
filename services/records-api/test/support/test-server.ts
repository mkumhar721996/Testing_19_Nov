import { buildApp } from '../../src/app.js';
import { testDeps } from './test-deps.js';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 8011);

const app = buildApp(testDeps());
app.listen({ host, port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
