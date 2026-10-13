import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Every number the Pay off or invest page shows, checked against the API response it came from: the banner,
 * the cards in each market scenario, the milestone table (also in today's dollars), the crossover notes and
 * the fact sheet. The API's numbers are themselves pinned by the backend's reference tests; this proves the
 * page shows them faithfully, for very different households.
 */

interface Year { year: number; netWorth: number; netWorthInTodaysDollars: number }
interface Projection { payoffDate: string | null; crossoverMonth: number | null; crossoverDate: string | null; years: Year[] }
interface Outcome { strategy: Strategy; investPercent: number; expected: Projection; riskAdjusted: Projection; badDecade: Projection }
interface Comparison {
  recommended: Strategy; runnerUp: Strategy; lead: number; badDecadeWinner: Strategy;
  rates: { afterTaxMortgageRate: number; firstYearInterest: number; standardDeduction: number; hybridInvestPercent: number; riskAdjustedReturn: number };
  strategies: Outcome[];
}
type Strategy = 'PayOffFirst' | 'InvestTheDifference' | 'Hybrid';
type Scenario = 'riskAdjusted' | 'expected' | 'badDecade';

const NAMES: Record<Strategy, string> = { PayOffFirst: 'Debt free ASAP', InvestTheDifference: 'Invest the difference', Hybrid: 'Hybrid' };
const SHORT: Record<Strategy, string> = { PayOffFirst: 'Pay off first', InvestTheDifference: 'Invest', Hybrid: 'Hybrid' };
const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const pct = (value: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}%`;
const month = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const final = (p: Projection) => p.years[p.years.length - 1].netWorth;

/** Remembers the latest comparison the page received, so the checks use exactly what is on screen. */
function watchComparisons(page: Page) {
  let latest: Comparison | null = null;
  let reading = 0; // responses whose bodies are still being read
  page.on('response', async (response) => {
    if (!response.url().endsWith('/api/v1/strategies/compare') || !response.ok()) return;
    reading++;
    try {
      latest = (await response.json()) as Comparison;
    } finally {
      reading--;
    }
  });
  return async () => {
    await expect(page.getByTestId('results'), 'the latest comparison has arrived').toHaveAttribute('aria-busy', 'false');
    // The page shows the newest response only once it is busy no more; wait until every body has been read too.
    await expect.poll(() => (reading === 0 ? latest : null), { message: 'every comparison the page received has been read' }).not.toBeNull();
    return latest!;
  };
}

async function checkEverything(page: Page, api: Comparison) {
  // The banner.
  await expect(page.getByTestId('recommended'), 'the recommended strategy').toHaveText(NAMES[api.recommended]);
  if (api.lead > 0) {
    await expect(page.getByTestId('recommended-detail'), 'its lead over the runner-up')
      .toContainText(`${usd(api.lead)} ahead of ${NAMES[api.runnerUp]}`);
  }
  if (api.badDecadeWinner !== api.recommended) {
    const outcome = (s: Strategy) => api.strategies.find((o) => o.strategy === s)!;
    const margin = final(outcome(api.badDecadeWinner).badDecade) - final(outcome(api.recommended).badDecade);
    await expect(page.getByTestId('downside'), 'what a lost decade would do').toContainText(`${NAMES[api.badDecadeWinner]} would win by ${usd(margin)}`);
  } else {
    await expect(page.getByTestId('downside'), 'that a lost decade would not change it').toContainText('It stays ahead');
  }

  for (const scenario of ['riskAdjusted', 'expected', 'badDecade'] as Scenario[]) {
    await page.getByTestId(`scenario-${scenario}`).check();
    const finals = api.strategies.map((o) => final(o[scenario]));
    const best = Math.max(...finals);
    const leader = api.strategies[finals.indexOf(best)].strategy;

    // The cards: standing, net worth and payoff, in this scenario.
    for (const [i, o] of api.strategies.entries()) {
      const card = page.getByTestId(`card-${o.strategy}`);
      const behind = best - finals[i];
      await expect(card, `${o.strategy} (${scenario}): net worth`).toContainText(`${usd(finals[i])} net worth`);
      await expect(card, `${o.strategy} (${scenario}): standing`)
        .toContainText(Math.round(behind) === 0 ? 'Highest after 30 years' : `${usd(behind)} behind ${SHORT[leader]}`);
      await expect(card, `${o.strategy} (${scenario}): payoff`)
        .toContainText(o[scenario].payoffDate ? `mortgage-free ${month(o[scenario].payoffDate!)}` : 'mortgage still owed at year 30');
    }

    // The milestones, with each value's difference from paying off first; then in today's dollars.
    await page.getByTestId('tab-milestones').click();
    for (const todays of [false, true]) {
      const toggle = page.getByTestId('todays-dollars');
      if ((await toggle.isChecked()) !== todays) await toggle.click();
      const rows = page.getByTestId('milestones').locator('tbody tr');
      for (const [r, year] of [5, 10, 15, 30].entries()) {
        const values = api.strategies.map((o) => (todays ? o[scenario].years[year].netWorthInTodaysDollars : o[scenario].years[year].netWorth));
        const cells = rows.nth(r).locator('td');
        for (const [c, value] of values.entries()) {
          await expect(cells.nth(c), `year ${year}, ${api.strategies[c].strategy}, ${scenario}${todays ? ", today's dollars" : ''}`)
            .toContainText(usd(value));
        }
      }
    }
    await page.getByTestId('todays-dollars').uncheck();

    // When the investments pass the mortgage, for every strategy.
    await page.getByTestId('tab-crossover').click();
    for (const o of api.strategies) {
      await page.getByTestId(`crossover-${o.strategy}`).check();
      const p = o[scenario];
      const expected = p.crossoverMonth === 0 ? 'already cover the mortgage'
        : p.crossoverDate ? `in ${month(p.crossoverDate)}` : 'never catch up';
      await expect(page.getByTestId('crossover-note'), `${o.strategy} (${scenario}): crossover`).toContainText(expected);
    }
    await page.getByTestId('tab-overTime').click();
  }
  await page.getByTestId('scenario-riskAdjusted').check();

  // The fact sheet quotes the rates it rests on.
  await page.getByTestId('tab-why').click();
  const facts = page.getByTestId('fact-sheet');
  await expect(facts, 'the mortgage rate it rests on').toContainText(`earns ${pct(api.rates.afterTaxMortgageRate)} for certain`);
  await expect(facts, 'the return it counts on').toContainText(`counts on ${pct(api.rates.riskAdjustedReturn)}`);
  await expect(facts, 'the year-1 interest').toContainText(usd(api.rates.firstYearInterest));
  await expect(facts, 'the standard deduction').toContainText(usd(api.rates.standardDeduction));
  await expect(facts, 'the hybrid split').toContainText(`invests ${pct(api.rates.hybridInvestPercent)} of your extra cash`);
  await page.getByTestId('tab-overTime').click();
}

test.describe('Pay off or invest: every number on the page matches the API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/strategy');
  });

  test('the typical household', async ({ page }) => {
    const latest = watchComparisons(page);
    await checkEverything(page, await latest());
  });

  test('a high-income single filer who itemizes, sells RSUs and buys through an ESPP', async ({ page }) => {
    const latest = watchComparisons(page);
    await page.getByTestId('balance').fill('700000');
    await page.getByTestId('home-value').fill('900000');
    await page.getByTestId('rate').fill('7');
    await page.getByTestId('years-left').fill('30');
    await page.getByTestId('monthly-cash').fill('3000');
    await page.getByTestId('section-taxes').locator('summary').click();
    await page.getByTestId('income').fill('250000');
    await page.getByTestId('tax-rate').fill('29');
    await page.getByTestId('filing-status').selectOption('Single');
    await page.getByTestId('other-deductions').fill('28000');
    await page.getByTestId('capital-gains-rate').fill('23.8');
    await page.getByTestId('section-stock').locator('summary').click();
    await page.getByTestId('rsu').fill('40000');
    await page.getByTestId('sell-rsus').check();
    await page.getByTestId('espp-percent').fill('10');
    await page.getByTestId('espp-period').fill('5');

    await checkEverything(page, await latest());
    await page.getByTestId('tab-why').click();
    await expect(page.getByTestId('fact-sheet'), 'itemizing applies here').toContainText('Itemizing beats your $16,100 standard deduction');
  });

  test('a conservative household with a cheap mortgage, plenty of company stock and no match', async ({ page }) => {
    const latest = watchComparisons(page);
    await page.getByTestId('rate').fill('3');
    await page.getByTestId('risk-Conservative').check();
    await page.getByTestId('section-savings').locator('summary').click();
    await page.getByTestId('match-percent').fill('0');
    await page.getByTestId('section-stock').locator('summary').click();
    await page.getByTestId('rsu').fill('60000');
    await page.getByTestId('esop').fill('5000');

    await checkEverything(page, await latest());
  });

  test('the server accepts every field at the edge of its range, so the page and the API agree on the limits', async ({ page }) => {
    const latest = watchComparisons(page);
    for (const section of ['section-taxes', 'section-savings', 'section-stock', 'section-market']) {
      await page.getByTestId(section).locator('summary').click();
    }
    const highest: [string, string][] = [
      ['rate', '30'], ['years-left', '30'], ['monthly-cash', '100000000'], ['income', '100000000'], ['tax-rate', '60'],
      ['capital-gains-rate', '60'], ['other-deductions', '100000000'], ['match-percent', '200'], ['match-up-to', '100'],
      ['ira', '7500'], ['espp-percent', '25'], ['espp-discount', '15'], ['espp-period', '27'], ['expected-return', '30'],
      ['inflation', '20'], ['home-growth', '25'],
    ];
    for (const [id, value] of highest) await page.getByTestId(id).fill(value);

    await latest();
    await expect(page.getByTestId('calculation-errors'), 'the API accepted every highest value').toHaveCount(0);
    await expect(page.getByTestId('stale-results'), 'and the form agreed they were valid').toHaveCount(0);

    const lowest: [string, string][] = [
      ['rate', '0'], ['years-left', '0.09'], ['monthly-cash', '0'], ['income', '0'], ['tax-rate', '0'], ['capital-gains-rate', '0'],
      ['match-percent', '0'], ['espp-period', '1'], ['expected-return', '-10'], ['inflation', '-5'], ['home-growth', '-20'],
    ];
    for (const [id, value] of lowest) await page.getByTestId(id).fill(value);

    await latest();
    await expect(page.getByTestId('calculation-errors'), 'the API accepted every lowest value').toHaveCount(0);
    await expect(page.getByTestId('stale-results'), 'and the form agreed they were valid').toHaveCount(0);
  });

  test('an out-of-range value is flagged on the field, and the results are marked as the last valid ones', async ({ page }) => {
    await page.getByTestId('section-taxes').locator('summary').click();
    await page.getByTestId('tax-rate').fill('75');

    await expect(page.getByTestId('error-tax-rate'), 'the field says what is wrong').toHaveText('Tax rate must be between 0% and 60%.');
    await expect(page.getByTestId('stale-results'), 'the results say they are out of date, and why').toContainText('Tax rate must be between 0% and 60%.');

    await page.getByTestId('tax-rate').fill('24');
    await expect(page.getByTestId('stale-results'), 'fixing it clears the notice').toHaveCount(0);
  });
});
