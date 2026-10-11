import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The refinance comparison against the real API. The worked example is the reference refinance
 * (7% with 25 years left, to 6% over a new 30 years, $6,000 at closing), whose numbers were
 * computed independently of the code.
 */
test.describe('Refinance', () => {
  const verdict = (page: Page) => page.getByTestId('refi-verdict');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Refinance' }).click();
    await expect(page, 'the Refinance page has its own URL').toHaveURL(/\/refinance$/);
    await expect(page.getByTestId('results'), 'the first comparison has arrived').toHaveAttribute('aria-busy', 'false');
  });

  test('shows that a lower payment can still cost more, and the way around it', async ({ page }) => {
    await expect(verdict(page), 'the restarted 30 years outweigh the lower rate').toContainText('Refinancing costs $17,415 more');
    await expect(page.getByTestId('refi-payment'), 'even though the payment drops').toContainText('$321.69 less than now');
    await expect(page.getByTestId('refi-payoff'), 'because the loan runs five years longer').toContainText('5 yr later than now');
    await expect(page.getByTestId('refi-break-even'), 'the interest saved covers the costs by payment 25').toContainText('after 25 payments');
    await expect(page.getByTestId('refi-restart'), 'the restarted clock is explained').toContainText('The clock restarts');
    await expect(page.getByTestId('refi-keep-payment'), 'keeping the current payment turns it into a saving').toContainText('saving $107,590 overall');
  });

  test('keeping the payoff date stops the clock restarting', async ({ page }) => {
    await page.getByTestId('new-term').selectOption('keep');

    await expect(verdict(page), 'the same rate cut now saves money').toContainText('Refinancing saves');
    await expect(page.getByTestId('refi-payoff'), 'and the loan ends when it would have').toContainText('same as now');
    await expect(page.getByTestId('refi-restart'), 'nothing restarts').toHaveCount(0);
  });

  test('rolling the closing costs into the loan still counts them', async ({ page }) => {
    await page.getByTestId('finance-closing-costs').check();

    await expect(verdict(page), 'borrowed costs are repaid with interest').toContainText('Refinancing costs $24,367 more');
    await expect(page.getByTestId('refi-table'), 'the table shows where the costs went').toContainText('$6,000 in the loan');
  });
});
