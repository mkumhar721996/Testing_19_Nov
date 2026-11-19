import { defineConfig } from '@playwright/test';

const port = 3111;

export default defineConfig({
  testDir: 'test/e2e',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `pnpm build && node dist/server.js`,
    env: { HOST: '127.0.0.1', PORT: String(port), RECORDS_STORE: 'memory', NODE_ENV: 'test' },
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
