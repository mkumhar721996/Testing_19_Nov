import { defineConfig } from '@playwright/test';

const port = 3111;

export default defineConfig({
  testDir: 'test/e2e',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `pnpm build && (test -z "$DATABASE_URL" || (pnpm db:migrate && pnpm db:seed)) && pnpm exec tsx test/support/test-server.ts`,
    env: { HOST: '127.0.0.1', PORT: String(port), NODE_ENV: 'test' },
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
