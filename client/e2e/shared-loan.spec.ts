import { Page, expect, test } from '@playwright/test';

/**
 * The loan is typed once: the balance, rate and years left (and the home's value) entered on one page are where
 * the next page starts, and each page keeps its own other inputs. Pages are reached through the navigation, as a
 * person would, so the app's state carries over.
 */
test.describe('One loan across the pages', () => {
  const go = async (page: Page, name: string) => {
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name, exact: true }).click();
    await expect(page.getByTestId('results'), `the ${name} page has its first result`).toHaveAttribute('aria-busy', 'false');
  };
  const box = (page: Page, testId: string) => page.getByTestId(testId);

  test('a loan typed on Refinance carries over to Pay off or invest, and back', async ({ page }) => {
    await page.goto('/refinance');
    await box(page, 'current-balance').fill('250000');
    await box(page, 'current-rate').fill('7.25');
    await box(page, 'years-left').fill('22');

    await go(page, 'Pay off or invest');
    await expect(box(page, 'balance'), 'the balance carried over').toHaveValue('250,000');
    await expect(box(page, 'rate'), 'the rate carried over').toHaveValue('7.25');
    await expect(box(page, 'years-left'), 'the years left carried over').toHaveValue('22');
    await expect(box(page, 'loan-shared'), 'the page says where the loan came from').toContainText('Filled in from your loan on the Refinance page.');
    await expect(box(page, 'monthly-cash'), 'its own inputs are its own').toHaveValue('1,000');

    await box(page, 'balance').fill('240000');
    await go(page, 'Refinance');
    await expect(box(page, 'current-balance'), 'a change made here goes back too').toHaveValue('240,000');
    await expect(box(page, 'new-rate'), 'while the offer stays as it was').toHaveValue('6');
  });

  test('the loan on the Calculator is where the other pages start', async ({ page }) => {
    await page.goto('/calculator/overview');
    await expect(page.getByTestId('results'), 'the first calculation has arrived').toHaveAttribute('aria-busy', 'false');
    await box(page, 'home-price').fill('500000');
    await box(page, 'down-payment').fill('100000');
    await box(page, 'interest-rate').fill('6.25');

    await go(page, 'Pay off or invest');
    await expect(box(page, 'balance'), 'the price less the down payment').toHaveValue('400,000');
    await expect(box(page, 'home-value'), "the home's price").toHaveValue('500,000');
    await expect(box(page, 'rate'), 'the rate').toHaveValue('6.25');
    await expect(box(page, 'years-left'), 'the whole term is left').toHaveValue('30');
  });

  test('just opening a page does not overwrite a loan typed elsewhere', async ({ page }) => {
    await page.goto('/refinance');
    await box(page, 'current-balance').fill('123000');

    await go(page, 'Calculator'); // opens with its own example, unchanged
    await go(page, 'Pay off or invest');

    await expect(box(page, 'balance'), 'the loan typed on Refinance, not the calculator example').toHaveValue('123,000');
  });
});
