import { defineConfig } from '@playwright/test';
const port = process.env.DEPLOYLENS_TEST_PORT ?? '3100';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: 'chrome', headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'node apps/server/src/index.mjs', env: { PORT: port, HOST: '127.0.0.1' }, url: `http://127.0.0.1:${port}/api/health`, reuseExistingServer: false },
});
