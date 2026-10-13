import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

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
    await expect(box(page, 'monthly-pmi'), 'no PMI with 20% down').toHaveValue('0');
  });

  test("the Calculator's PMI goes with the loan, with the home's value it ends against", async ({ page }) => {
    await page.goto('/calculator/overview');
    await expect(page.getByTestId('results'), 'the first calculation has arrived').toHaveAttribute('aria-busy', 'false');
    await box(page, 'home-price').fill('400000');
    await box(page, 'down-payment').fill('20000');

    await go(page, 'Pay off or invest');
    await expect(box(page, 'monthly-pmi'), "0.5% of $380,000 a year, a twelfth a month").toHaveValue('158.33');

    await go(page, 'Refinance');
    await expect(box(page, 'home-value'), "the home's price").toHaveValue('400,000');
    await expect(box(page, 'current-pmi'), 'and the same PMI').toHaveValue('158.33');
  });

  test('the Calculator takes the loan too, rounding part years without changing them elsewhere', async ({ page }) => {
    await page.goto('/strategy');
    await expect(page.getByTestId('results'), 'the first comparison has arrived').toHaveAttribute('aria-busy', 'false');
    await box(page, 'balance').fill('280000');
    await box(page, 'years-left').fill('22.5');

    await go(page, 'Calculator');
    await expect(box(page, 'home-price'), "the home's value").toHaveValue('400,000');
    await expect(box(page, 'down-payment'), 'what is not owed').toHaveValue('120,000');
    await expect(box(page, 'term-years'), 'the years left, to the nearest whole year').toHaveValue('23');
    await expect(box(page, 'loan-shared'), 'the rounding is explained').toContainText('with 22 yr 6 mo left rounded to 23 yr');

    await go(page, 'Pay off or invest');
    await expect(box(page, 'years-left'), 'the rounding stays on the Calculator').toHaveValue('22.5');
  });

  test('a loan already being paid shares what is owed today, and the payments left', async ({ page }) => {
    // Five years ago, on the first of the month: 60 or 61 payments made, depending on whether today is the 1st.
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 60, 1);
    const firstPayment = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const made = now.getDate() > 1 ? 61 : 60;
    // $200,000 at 6% over 30 years, by the textbook formula.
    const r = 0.005;
    const owed = Math.round(200_000 * ((1 + r) ** 360 - (1 + r) ** made) / ((1 + r) ** 360 - 1) * 100) / 100;

    await page.goto('/calculator/overview');
    await expect(page.getByTestId('results'), 'the first calculation has arrived').toHaveAttribute('aria-busy', 'false');
    await box(page, 'home-price').fill('250000');
    await box(page, 'down-payment').fill('50000');
    await box(page, 'interest-rate').fill('6');
    await box(page, 'first-payment-date').fill(firstPayment);
    await expect(box(page, 'existing-loan'), 'the form says which payment is next')
      .toContainText(`payment ${made + 1} of 360 is next`);

    await go(page, 'Refinance');
    await expect(box(page, 'original-amount'), 'Refinance takes the loan as it started').toHaveValue('200,000');
    await expect(box(page, 'first-payment-date'), 'from its real first payment').toHaveValue(firstPayment);
    await expect(box(page, 'original-loan-today'), 'and knows where it stands today')
      .toContainText(`Payment ${made + 1} of 360 is next, with about ${owed.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} owed`);

    await box(page, 'loan-entry-today').check();
    await expect(box(page, 'current-balance'), 'what is owed today')
      .toHaveValue(owed.toLocaleString('en-US', { maximumFractionDigits: 2 }));
    await expect(box(page, 'years-left'), 'the payments left, in years')
      .toHaveValue(((360 - made) / 12).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  });

  test('Refinance can start from the original loan, and hands it to the Calculator as it started', async ({ page }) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 60, 1);
    const firstPayment = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const made = now.getDate() > 1 ? 61 : 60;

    await page.goto('/refinance');
    await expect(page.getByTestId('results'), 'the first comparison has arrived').toHaveAttribute('aria-busy', 'false');
    await box(page, 'loan-entry-original').check();
    await box(page, 'original-amount').fill('200000');
    await box(page, 'original-term').fill('30');
    await box(page, 'current-rate').fill('6');
    await box(page, 'first-payment-date').fill(firstPayment);

    await expect(box(page, 'original-loan-today'), 'the form says where the loan stands').toContainText(`Payment ${made + 1} of 360 is next`);
    await expect(page.getByTestId('results'), 'the comparison has caught up').toHaveAttribute('aria-busy', 'false');
    await expect(box(page, 'refi-table').locator('tr', { hasText: 'Payments' }).locator('td').first(),
      "the API worked out the payments left from the loan's own schedule").toHaveText(String(360 - made));

    await go(page, 'Calculator');
    await expect(box(page, 'first-payment-date'), 'the real start').toHaveValue(firstPayment);
    await expect(box(page, 'term-years'), 'the original term').toHaveValue('30');
    await expect(box(page, 'existing-loan'), 'the same loan, as far along').toContainText(`payment ${made + 1} of 360 is next`);
  });

  test('the rate type carries over too: an ARM set on Pay off or invest reaches Refinance and the Calculator', async ({ page }) => {
    await page.goto('/strategy');
    await expect(page.getByTestId('results'), 'the first comparison has arrived').toHaveAttribute('aria-busy', 'false');
    await page.getByTestId('section-rate').locator('summary').click();
    await page.getByTestId('rate-type-arm').check();
    await box(page, 'arm-fixed-months').fill('60');
    await box(page, 'arm-expected-rate').fill('8.5');

    await go(page, 'Refinance');
    await expect(box(page, 'current-rate-summary'), "the current loan is the same ARM, its reset 60 payments away")
      .toHaveText('Adjustable: 6.5% for 60 more payments, then toward 8.5% (caps 5/2/5, floor 2.75%)');

    await go(page, 'Calculator');
    await expect(box(page, 'rate-summary'), 'a new loan fixed for 60 payments, then yearly: a 5/1 ARM')
      .toHaveText('5/1 ARM: 6.5% for 5 yr, then toward 8.5% (caps 5/2/5, floor 2.75%)');
  });

  test('just opening a page does not overwrite a loan typed elsewhere', async ({ page }) => {
    await page.goto('/refinance');
    await box(page, 'current-balance').fill('123000');

    await go(page, 'Calculator'); // opens with its own example, unchanged
    await go(page, 'Pay off or invest');

    await expect(box(page, 'balance'), 'the loan typed on Refinance, not the calculator example').toHaveValue('123,000');
  });
});
