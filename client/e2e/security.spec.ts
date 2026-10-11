import { expect, test } from './fixtures';

test('the app is served under its Content-Security-Policy, and runs within it', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.headers()['content-security-policy'], 'the page carries the policy, as it does in production').toContain("script-src 'self'");
  await expect(page.getByTestId('monthly-payment'), 'the app still starts and calculates under the policy').toBeVisible();
});
