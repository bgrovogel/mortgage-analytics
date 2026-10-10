import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { API_URL, APP_URL } from './e2e/env';

/**
 * End-to-end tests run against the real stack: the .NET API plus the Angular dev server,
 * which proxies /api to it. Playwright starts both (or reuses ones already running locally).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // No retries: a flaky test should fail loudly and be fixed, not be hidden by a second attempt.
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `dotnet run --project ../src/MortgageAnalytics.Api --no-launch-profile --urls ${API_URL}`,
      url: `${API_URL}/health`,
      // Saved calculations go to a scratch database, not the one used for local development.
      env: { ConnectionStrings__Calculations: `Data Source=${join(tmpdir(), 'mortgage-analytics-e2e.db')}` },
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: `npm start -- --port ${new URL(APP_URL).port}`,
      url: APP_URL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
