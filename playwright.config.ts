import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

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
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
