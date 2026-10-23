import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The refinance comparison against the real API. The worked example is the reference refinance
 * (7% with 25 years left, to 6% over a new 30 years, $6,000 at closing), whose numbers were
 * computed independently of the code.
 */
test.describe('Refinance', () => {
  const verdict = (page: Page) => page.getByTestId('refi-verdict');
  /** The reference refinance: 25 years left, into 6%. The page's example is a 2024 loan (28 years left) into today's 6.25%. */
  const reference = async (page: Page) => {
    await page.getByTestId('years-left').fill('25');
    await page.getByTestId('new-rate').fill('6');
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/calculator');
    await page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Refinance' }).click();
    await expect(page, 'the Refinance page has its own URL').toHaveURL(/\/refinance$/);
    await expect(page.getByTestId('results'), 'the first comparison has arrived').toHaveAttribute('aria-busy', 'false');
  });

  test('the example: a 2024 loan at 7% into 6.25% saves money, though restarting the clock costs part of it', async ({ page }) => {
    await expect(verdict(page), '28 years left: two years added, outweighed by the lower rate').toContainText('Refinancing saves $14,067');
    await expect(page.getByTestId('refi-payment'), 'the payment drops').toContainText('$191.68 less than now');
    await expect(page.getByTestId('refi-restart'), 'and the restart is why it saves less').toContainText('saves less than the lower rate alone would');
  });

  test('shows that a lower payment can still cost more, and the way around it', async ({ page }) => {
    await reference(page);
    await expect(verdict(page), 'the restarted 30 years outweigh the lower rate').toContainText('Refinancing costs $17,415 more');
    await expect(page.getByTestId('refi-payment'), 'even though the payment drops').toContainText('$321.69 less than now');
    await expect(page.getByTestId('refi-payoff'), 'because the loan runs five years longer').toContainText('5 yr later than now');
    await expect(page.getByTestId('refi-break-even'), 'the interest saved covers the costs by payment 25').toContainText('after 25 payments');
    await expect(page.getByTestId('refi-restart'), 'the restarted clock is explained').toContainText('The clock restarts');
    await expect(page.getByTestId('refi-keep-payment'), 'keeping the current payment turns it into a saving').toContainText('saving $107,590 overall');
  });

  test('taking cash out: what is in hand, and a warning when the new loan is above what lenders allow', async ({ page }) => {
    await reference(page);
    await page.getByTestId('section-new-extras').locator('summary').click(); // cash out is one step in, with PMI

    await page.getByTestId('cash-out').fill('50000');

    await expect(verdict(page), 'the verdict is about the cash').toContainText('Taking out $50,000 costs');
    await expect(page.getByTestId('refi-cash'), 'the cash in hand is the cash less the closing costs').toContainText('$44,000');
    await expect(page.getByTestId('refi-break-even'), 'a break-even is not the question when cash is taken').toHaveCount(0);
    await expect(page.getByTestId('refi-cash-limit'), '$350,000 against the $400,000 home is over the 80% limit')
      .toContainText('87.5% of the home');
    await expect(page.getByTestId('refi-cash-limit'), 'and says it may not be offered').toContainText('may not be offered');

    await page.getByTestId('cash-out').fill('0');

    await expect(page.getByTestId('refi-cash'), 'no cash, no cash tile').toHaveCount(0);
    await expect(page.getByTestId('refi-break-even'), 'the break-even is back').toBeVisible();
  });

  test('borrowing the cash as a home-equity loan instead: the two ways side by side, over the years kept', async ({ page }) => {
    await reference(page);
    await page.getByTestId('home-value').fill('500000'); // within 80%, so neither loan carries PMI and the figures are the independent ones
    await page.getByTestId('section-new-extras').locator('summary').click();
    await page.getByTestId('cash-out').fill('50000');
    await expect(page.getByTestId('refi-home-equity'), 'not shown until asked for').toHaveCount(0);

    await page.getByTestId('compare-equity-loan').check();

    // $300,000 at 7% with 25 years left; $50,000 at 8% over 15 years, or a refinance to 6%; 7 years: worked out independently.
    await expect(page.getByTestId('refi-equity-verdict'), 'the home-equity loan costs more, as the API works it out')
      .toContainText('costs $16,044 more over 7 years than refinancing');
    await expect(page.getByTestId('refi-equity-cost'), 'the totals, to the dollar: keeping the loan and borrowing').toContainText('$512,050');
    await expect(page.getByTestId('refi-equity-cost'), 'against the cash-out refinance').toContainText('$496,006');
    await expect(page.getByTestId('refi-equity-limit'), '$350,000 of the $500,000 home is within 80%')
      .toContainText('70% of its value, within the 80%');

    await page.getByTestId('years-kept').fill('30');

    await expect(page.getByTestId('refi-equity-verdict'), 'over 30 years, the answer is costed again').toContainText('over 30 years');

    await page.getByTestId('compare-equity-loan').uncheck();

    await expect(page.getByTestId('refi-home-equity'), 'switching it off takes the panel away').toHaveCount(0);
  });

  test('borrowing the cash as a home-equity line instead: interest only while it is drawn, then repaid', async ({ page }) => {
    await reference(page);
    await page.getByTestId('home-value').fill('500000');
    await page.getByTestId('section-new-extras').locator('summary').click();
    await page.getByTestId('cash-out').fill('50000');
    await page.getByTestId('compare-equity-loan').check();
    await expect(page.getByTestId('equity-draw-years'), 'a loan has no draw period to ask for').toHaveCount(0);

    await page.getByTestId('equity-kind-line').check();
    // The form swaps its fields for a line's: wait for them, or the term is typed into the loan's field as it goes.
    await expect(page.getByTestId('equity-draw-years'), 'a line asks for its draw period').toBeVisible();
    await page.getByTestId('equity-term').fill('20');
    await page.getByTestId('equity-repayment-rate').fill('9');

    // 8% interest only for 10 years, then 20 years at an expected 9%, kept 7 years: worked out independently in Python Decimal.
    await expect(page.getByTestId('refi-equity-verdict'), 'the line costs more than the refinance, as the API works it out')
      .toContainText('on a home-equity line costs $20,106 more over 7 years than refinancing');
    await expect(page.getByTestId('refi-equity-line-note'), 'the line is interest only, then repaid at the rate expected')
      .toContainText('interest only for 10 yr, then $449.86 a month for 20 yr at 9%');
    await expect(page.getByTestId('refi-equity-cost'), 'the totals, to the dollar: the line and the current loan').toContainText('$516,112');

    await page.getByTestId('years-kept').fill('12');

    await expect(page.getByTestId('refi-equity-verdict'), 'kept past the draw period, the repayment is costed too')
      .toContainText('costs $36,000 more over 12 years');

    await page.getByTestId('equity-kind-loan').check();

    await expect(page.getByTestId('refi-equity-verdict'), 'back to a plain loan').toContainText('borrowing $50,000 separately');
    await expect(page.getByTestId('refi-equity-line-note'), 'with no line note').toHaveCount(0);
  });

  test('paying off a debt with the cash out: the card kept, against the mortgage it is moved onto', async ({ page }) => {
    await reference(page);
    await page.getByTestId('home-value').fill('500000'); // within 80%, so neither loan carries PMI and the figures are the independent ones
    await page.getByTestId('section-new-extras').locator('summary').click();
    await page.getByTestId('cash-out').fill('50000');
    await expect(page.getByTestId('refi-debt'), 'not shown until asked for').toHaveCount(0);

    await page.getByTestId('pay-off-debt').check();
    await page.getByTestId('debt-balance').fill('20000');
    await page.getByTestId('debt-payment').fill('600');

    // A $20,000 card at 22% with $600 a month, paid off with $20,000 of the $50,000, over 7 years: worked out independently.
    await expect(page.getByTestId('refi-debt-verdict'), 'paying off an expensive card is cheaper, and the payment falls')
      .toContainText('costs $3,192 less over 7 years than keeping it');
    await expect(page.getByTestId('refi-debt-verdict'), 'the $600 card payment less the $119.91 it adds to the mortgage')
      .toContainText('Each month you pay $480.09 less');
    await expect(page.getByTestId('refi-debt-table'), 'keeping it costs $31,192 in all').toContainText('$31,192');
    await expect(page.getByTestId('refi-debt-table'), 'moving it onto the mortgage $28,000, most of it still owed').toContainText('$28,000');

    // With a $120,000 income and $500 of other debts: (2,120.34 + 600 + 500) over 10,000, then (2,098.43 + 500) over 10,000.
    await page.getByTestId('debt-income').fill('120000');
    await page.getByTestId('debt-other-debts').fill('500');
    await expect(page.getByTestId('refi-debt-dti'), 'the loan payments and debts fall from 32.2% to 25.98% of income')
      .toContainText('go from 32.2% to 25.98% of it');

    await page.getByTestId('debt-rate').fill('4');
    await page.getByTestId('debt-payment').fill('450');

    await expect(page.getByTestId('refi-debt-verdict'), 'a cheap car loan is dearer on the mortgage, though the payment still falls')
      .toContainText('costs $6,318 more over 7 years than keeping it');
    await expect(page.getByTestId('refi-debt-verdict'), 'which is what makes it tempting').toContainText('Each month you pay $330.09 less');

    await page.getByTestId('pay-off-debt').uncheck();

    await expect(page.getByTestId('refi-debt'), 'switching it off takes the panel away').toHaveCount(0);
  });

  test('buying points for a lower rate: what they cost, what they save, and when they pay for themselves', async ({ page }) => {
    await reference(page);
    await expect(page.getByTestId('refi-points'), 'not shown until asked for').toHaveCount(0);

    await page.getByTestId('buy-points').check();
    await page.getByTestId('rate-without-points').fill('6.25');

    // $300,000 refinanced to 6% (the rate with the points) against the lender's 6.25% without them, 1 point: worked out independently.
    await expect(page.getByTestId('refi-points-verdict'), 'a point on $300,000, and what it buys')
      .toContainText('Buying 1 point for $3,000 lowers the payment by $48.50 a month');
    await expect(page.getByTestId('refi-points-verdict'), 'the interest saved covers it by the 48th payment')
      .toContainText('pay for themselves after 48 payments');
    await expect(page.getByTestId('refi-points-table'), 'the payment at each rate').toContainText('$1,847.15');
    await expect(page.getByTestId('refi-verdict'), 'the points are paid with the $6,000 of closing costs, so the refinance costs $3,000 more')
      .toContainText('Refinancing costs $20,415 more');

    await page.getByTestId('points').fill('2');

    await expect(page.getByTestId('refi-points-verdict'), 'two points cost twice as much').toContainText('Buying 2 points for $6,000');

    await page.getByTestId('buy-points').uncheck();

    await expect(page.getByTestId('refi-points'), 'switching them off takes the panel away').toHaveCount(0);
    await expect(page.getByTestId('refi-verdict'), 'and the cost of the points with it').toContainText('Refinancing costs $17,415 more');
  });

  test('keeping the payoff date stops the clock restarting', async ({ page }) => {
    await reference(page);
    await page.getByTestId('new-term').selectOption('keep');

    await expect(verdict(page), 'the same rate cut now saves money').toContainText('Refinancing saves');
    await expect(page.getByTestId('refi-payoff'), 'and the loan ends when it would have').toContainText('same as now');
    await expect(page.getByTestId('refi-restart'), 'nothing restarts').toHaveCount(0);
  });

  test('rolling the closing costs into the loan still counts them', async ({ page }) => {
    await reference(page);
    await page.getByTestId('finance-closing-costs').check();

    await expect(verdict(page), 'borrowed costs are repaid with interest').toContainText('Refinancing costs $24,367 more');
    await expect(page.getByTestId('refi-table'), 'the table shows where the costs went').toContainText('$6,000 in the loan');
  });

  test('PMI on both loans counts in the payment, the totals and the break-even', async ({ page }) => {
    await reference(page);
    await page.getByTestId('home-value').fill('360000');
    await page.getByTestId('current-pmi').fill('120');

    await expect(page.getByTestId('refi-new-pmi'), '0.5% of $300,000 a year: the new loan is 83% of the value')
      .toContainText('with $125.00 PMI');
    await expect(page.getByTestId('refi-payment'), '$5 more PMI than now narrows the saving').toContainText('$316.69 less than now');
    await expect(page.getByTestId('refi-pmi'), "each loan's PMI is in the table").toBeVisible();
    await expect(page.getByTestId('refi-break-even'), 'and the break-even counts it').toContainText('the interest and PMI saved');
  });

  test('the options side by side fit a phone without scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/refinance');
    await expect(page.getByTestId('refi-table'), 'the table is shown').toBeVisible();

    const { scroll, shown } = await page.getByTestId('refi-table').evaluate((table) => {
      const wrap = table.closest('.table-wrap') as HTMLElement;
      return { scroll: wrap.scrollWidth, shown: wrap.clientWidth };
    });

    expect(scroll, 'every column is in view, none cut off at the edge').toBeLessThanOrEqual(shown + 1);
  });
});
