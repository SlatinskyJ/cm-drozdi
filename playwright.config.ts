import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { APP_TZ } from './e2e/helpers/date';

// Load .env for local dev. In CI, env vars are injected by the workflow.
config();

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // Serial — tests share a single DB instance
  retries: process.env.CI ? 1 : 0, // needed so trace: 'on-first-retry' actually captures a trace in CI
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    // Browser and app server (webServer.env) run in a non-UTC timezone: tRPC's
    // dateMiddleware shifts Dates by the server's UTC offset, and with a zero
    // offset (CI runners are UTC) bugs in undoing that shift are invisible.
    timezoneId: APP_TZ,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'yarn start',
    env: { TZ: APP_TZ },
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
