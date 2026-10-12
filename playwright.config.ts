import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { BROWSER_TZ, SERVER_TZ } from './e2e/helpers/date';

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
    // The app shows every date in Europe/Prague. The browser runs in a
    // different zone than both Prague and the server (webServer.env), so specs
    // prove the displayed times don't depend on either runtime's timezone.
    timezoneId: BROWSER_TZ,
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
    // UTC by default, as on Vercel. Note: locally an already-running server
    // on :3000 is reused as-is, whatever its TZ.
    env: { TZ: SERVER_TZ },
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
