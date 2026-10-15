import { expect, test } from './fixtures';

test('the app is served under its Content-Security-Policy, and runs within it', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.headers()['content-security-policy'], 'the page carries the policy, as it does in production').toContain("script-src 'self'");
  await expect(page.getByTestId('start-questions'), 'the app still starts under the policy').toBeVisible();

  await page.getByRole('link', { name: /What will this home cost\?/ }).click();
  await expect(page.getByTestId('monthly-payment'), 'and calculates under the policy').toBeVisible();
});
