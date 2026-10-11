import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Adjustable rates and buydowns on the Refinance and Pay off or invest pages, against the real API. The expected
 * numbers come from the independent models in tools/rate-check and tools/strategy-check.
 */
test.describe('Adjustable rates and buydowns beyond the calculator', () => {
  const arrived = (page: Page, what: string) =>
    expect(page.getByTestId('results'), `${what} has caught up`).toHaveAttribute('aria-busy', 'false');
  const open = async (page: Page, section: string) => {
    const details = page.getByTestId(section);
    if (!(await details.evaluate((d: HTMLDetailsElement) => d.open))) await details.locator('summary').click();
  };

  test('refinancing a 7% ARM about to reset to 9% saves money, and more in the worst case', async ({ page }) => {
    await page.goto('/refinance');
    await arrived(page, 'the worked example');
    await open(page, 'section-current-rate');
    await page.getByTestId('current-rate-type-arm').check();
    await page.getByTestId('current-arm-fixed-months').fill('24');
    await page.getByTestId('current-arm-expected-rate').fill('9');
    await page.getByTestId('current-arm-initial-cap').fill('2');
    await page.getByTestId('current-arm-periodic-cap').fill('2');
    await arrived(page, 'the comparison');

    await expect(page.getByTestId('refi-rates'), "today's 7% resets to 9% after two years").toContainText('7% → 9%, $2,120.34 → $2,496.08 a month');
    await expect(page.getByTestId('refi-verdict'), 'so refinancing saves money').toContainText('Refinancing saves $86,293');
    await expect(page.getByTestId('refi-worst-case'), 'and more if rates rise as far as the caps allow')
      .toContainText('refinancing would save $239,047 over the life of the loan');
  });

  test('a 2-1 buydown on the new loan is paid at closing and changes nothing overall', async ({ page }) => {
    await page.goto('/refinance');
    await arrived(page, 'the worked example');
    await open(page, 'section-new-rate');
    await page.getByTestId('new-rate-type-buydown').check();
    await arrived(page, 'the comparison');

    await expect(page.getByTestId('refi-buydown'), 'its cost, and the payments it lowers')
      .toContainText('The 2-1 buydown costs $6,655 at closing');
    await expect(page.getByTestId('refi-verdict'), 'the lifetime result does not change').toContainText('Refinancing costs $17,415 more');
  });

  test('pay off or invest on an ARM resetting to 8.5%: paying down wins, and the fact sheet says why', async ({ page }) => {
    await page.goto('/strategy');
    await arrived(page, 'the typical household');
    await open(page, 'section-rate');
    await page.getByTestId('rate-type-arm').check();
    await page.getByTestId('arm-fixed-months').fill('60');
    await page.getByTestId('arm-expected-rate').fill('8.5');
    await page.getByTestId('arm-initial-cap').fill('2');
    await page.getByTestId('arm-periodic-cap').fill('1');
    await arrived(page, 'the comparison');

    await expect(page.getByTestId('recommended'), 'an 8.1% average rate beats the 8% counted on').toHaveText('Debt free ASAP');
    await page.getByTestId('tab-why').click();
    await expect(page.getByTestId('fact-sheet'), 'the fact sheet explains the adjusting rate')
      .toContainText('Your rate adjusts: 6.5% now, 8.1% on average over the loan on the path you expect');
  });
});
