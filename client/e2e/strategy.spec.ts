import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The pay-off-or-invest comparison against the real API. The defaults are the server's reference household
 * (ReferenceStrategies.Typical), whose 30-year net worths were computed by an independent model.
 */
test.describe('Pay off or invest', () => {
  const verdict = (page: Page) => page.getByTestId('strategy-verdict');
  const results = (page: Page) => page.getByTestId('results');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Pay off or invest' }).click();
    await expect(page, 'the page has its own URL').toHaveURL(/\/strategy$/);
    await expect(results(page), 'the first comparison has arrived').toHaveAttribute('aria-busy', 'false');
  });

  test('recommends on the risk-adjusted return, and says a lost decade would reverse it', async ({ page }) => {
    await expect(page.getByTestId('recommended'), 'investing ends highest at a risk-adjusted 8%').toHaveText('Invest the difference');
    await expect(page.getByTestId('recommended-detail'), 'the ranking rests on the risk-adjusted return').toContainText('counting on 8% a year');
    await expect(page.getByTestId('downside'), 'but market returns are not guaranteed').toContainText('Debt free ASAP would win by $41,363');
    await expect(page.getByTestId('card-PayOffFirst'), 'the reference net worth, to the dollar').toContainText('$3,719,027');
    await expect(page.getByTestId('card-InvestTheDifference'), 'and investing').toContainText('$3,844,781');
    await expect(page.getByTestId('card-PayOffFirst'), 'each card leads with how far it is behind').toContainText('$125,755 behind Invest');
    await page.getByTestId('tab-milestones').click();
    await expect(page.getByTestId('closeness'), 'and the page says why the totals are close').toContainText('All three end within $125,755 (3.3%)');
    await page.getByTestId('tab-why').click();
    await expect(page.getByTestId('fact-sheet'), 'the standard deduction beats itemizing here').toContainText('saves no tax');
    await expect(page.getByTestId('fact-sheet'), 'and the extra cash grows tax-free in the IRA').toContainText('grows tax-free: the full 8%');
  });

  test('a bad decade changes every number on the page', async ({ page }) => {
    await page.getByTestId('scenario-badDecade').check();

    await expect(page.getByTestId('card-PayOffFirst'), 'paying off first, after a lost decade').toContainText('$3,187,296');
    await page.getByTestId('tab-milestones').click();
    await expect(page.getByTestId('milestones'), 'the table follows the scenario').toContainText('$3,145,932');
  });

  test('stock that arrives anyway sends the hybrid\'s extra cash to the mortgage', async ({ page }) => {
    await page.getByTestId('section-stock').locator('summary').click();
    await page.getByTestId('rsu').fill('50000');
    await page.getByTestId('esop').fill('5000');

    await expect(page.getByTestId('card-Hybrid'), 'already plenty in stock, so the hybrid pays down the mortgage').toContainText('All extra cash to the mortgage');
    await page.getByTestId('tab-why').click();
    await expect(page.getByTestId('fact-sheet'), 'and says why').toContainText('the diversified choice');
  });

  test('a conservative profile counts on less of the market', async ({ page }) => {
    await page.getByTestId('risk-Conservative').check();

    await expect(page.getByTestId('counting-on'), 'four points off the expected return').toContainText('counting on 6% a year');
    await expect(page.getByTestId('card-Hybrid'), 'so the hybrid leans to the mortgage').toContainText('38% invested, 62% to the mortgage');
  });

  test('PMI on the loan: paying down ends it sooner, and the comparison counts that', async ({ page }) => {
    await page.getByTestId('balance').fill('370000');
    await page.getByTestId('years-left').fill('30');
    await page.getByTestId('monthly-pmi').fill('150');

    await page.getByTestId('tab-why').click();
    await expect(page.getByTestId('fact-sheet'), 'PMI lasts until the balance is $320,000, 80% of the $400,000 home')
      .toContainText("Your PMI ends once you owe 80% of the home's value");
    await expect(page.getByTestId('fact-sheet'), 'which paying down reaches sooner').toContainText('Paying down saves');
  });
});
