import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_URL } from './e2e/env';

/**
 * End-to-end tests run against what ships: the production build of the Angular app, served by the .NET API, as in
 * the container. So the tests also run under the API's security headers (the Content-Security-Policy among them),
 * which the Angular dev server never sends. Playwright builds the app and starts the API (or reuses one already
 * running on APP_URL locally).
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
      command:
        'npm run build && ' +
        `dotnet run --project ../src/MortgageAnalytics.Api --no-launch-profile --urls ${APP_URL} --webroot "${join(__dirname, 'dist', 'client', 'browser')}"`,
      url: `${APP_URL}/health`,
      env: {
        // Saved calculations and accounts go to a scratch database, not the one used for local development.
        ConnectionStrings__Calculations: `Data Source=${join(tmpdir(), 'mortgage-analytics-e2e.db')}`,
        // Development, as for a local demo: emails land in the outbox, which the tests read through the
        // dev mailbox endpoint, exactly as a person does in the browser.
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
      reuseExistingServer: !process.env['CI'],
      // A production build of the app, then a build of the API.
      timeout: 300_000,
    },
  ],
});
