import { Page, expect, test } from '@playwright/test';

/**
 * The pay-off-or-invest comparison against the real API. The defaults are the server's reference household
 * (ReferenceStrategies.Typical), whose 30-year net worths were computed by an independent model.
 */
test.describe('Pay off or invest', () => {
  const verdict = (page: Page) => page.getByTestId('strategy-verdict');
  const results = (page: Page) => page.getByTestId('strategy-results');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Pay off or invest' }).click();
    await expect(page, 'the page has its own URL').toHaveURL(/\/strategy$/);
    await expect(results(page), 'the first comparison has arrived').toHaveAttribute('aria-busy', 'false');
  });

  test('recommends on the risk-adjusted return, and says a lost decade would reverse it', async ({ page }) => {
    await expect(page.getByTestId('recommended'), 'investing ends highest at a risk-adjusted 8%').toHaveText('Invest the difference');
    await expect(page.getByTestId('recommended-detail'), 'the ranking rests on the risk-adjusted return').toContainText('counting on 8% a year');
    await expect(page.getByTestId('downside'), 'but market returns are not guaranteed').toContainText('Debt free ASAP comes out ahead by $41,363');
    await expect(page.getByTestId('card-PayOffFirst'), 'the reference net worth, to the dollar').toContainText('$3,719,027');
    await expect(page.getByTestId('card-InvestTheDifference'), 'and investing').toContainText('$3,844,781');
    await expect(page.getByTestId('card-PayOffFirst'), 'each card leads with how far it is behind').toContainText('$125,755 behind Invest');
    await expect(page.getByTestId('closeness'), 'and the page says why the totals are close').toContainText('All three end within $125,755 (3.3%)');
    await expect(page.getByTestId('fact-sheet'), 'the standard deduction beats itemizing here').toContainText('saves no tax');
  });

  test('a bad decade changes every number on the page', async ({ page }) => {
    await page.getByTestId('scenario-badDecade').check();

    await expect(page.getByTestId('card-PayOffFirst'), 'paying off first, after a lost decade').toContainText('$3,187,296');
    await expect(page.getByTestId('milestones'), 'the table follows the scenario').toContainText('$3,145,932');
  });

  test('stock that arrives anyway sends the hybrid\'s extra cash to the mortgage', async ({ page }) => {
    await page.getByTestId('section-stock').locator('summary').click();
    await page.getByTestId('rsu').fill('30000');
    await page.getByTestId('esop').fill('5000');

    await expect(page.getByTestId('card-Hybrid'), 'already plenty in stock, so the hybrid pays down the mortgage').toContainText('All extra cash to the mortgage');
    await expect(page.getByTestId('fact-sheet'), 'and says why').toContainText('the diversified choice');
  });

  test('a conservative profile counts on less of the market', async ({ page }) => {
    await page.getByTestId('risk-Conservative').check();

    await expect(page.getByTestId('counting-on'), 'four points off the expected return').toContainText('counting on 6% a year');
    await expect(page.getByTestId('card-Hybrid'), 'so the hybrid leans to the mortgage').toContainText('15% invested, 85% to the mortgage');
  });
});
