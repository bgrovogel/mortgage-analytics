import { expect, test } from './fixtures';

// The reference loans start in the future: a first payment in the past would make them loans already being paid,
// whose extra payments start with the next payment instead of the first.

/** $250,000 home with 20% down: a $200,000 loan at 6%, whose reference values the unit tests verify. */
const TWENTY_PERCENT_DOWN = { homePrice: 250_000, downPayment: 50_000, rate: 6, years: 30, firstPayment: '2036-01-01' };

/** The same home with 5% down at 6.5%, which needs PMI. */
const FIVE_PERCENT_DOWN = { homePrice: 250_000, downPayment: 12_500, rate: 6.5, years: 30, firstPayment: '2036-01-01' };

test.describe('Mortgage calculator', () => {
  test('shows a worked example with taxes, insurance and PMI on first load', async ({ calculator }) => {
    await expect(calculator.breakdown, 'the breakdown starts with principal and interest').toContainText('Principal & interest');
    await expect(calculator.breakdown, 'the default example includes property tax, as one rate').toContainText('Property tax');
    await expect(calculator.breakdown, 'the default example has 5% down, so PMI').toContainText('PMI');
    await expect(calculator.pmiEnd, 'the PMI end date is shown when PMI applies').toBeVisible();
    await expect(calculator.chart, 'the balance chart renders').toBeVisible();
    await calculator.showResults('schedule');
    await expect(calculator.scheduleRows.first(), 'the schedule table has rows').toBeVisible();
  });

  test('keeps advanced options collapsed, each summarized in one line', async ({ calculator }) => {
    for (const id of ['section-taxes', 'section-costs', 'section-closing', 'section-growth', 'section-options']) {
      await expect(calculator.section(id), `${id} should start closed`).not.toHaveAttribute('open');
    }
    await expect(calculator.sectionSummary('taxes-summary'), 'a closed section summarizes its values')
      .toHaveText('Tax 2.2% · Homestead $50,000 off');
    await expect(calculator.field('property-tax-rate'), 'fields inside a closed section are hidden').toBeHidden();

    await calculator.openSection('section-taxes');

    await expect(calculator.field('property-tax-rate'), 'opening the section reveals its fields').toBeVisible();
  });

  // At 1100px the page links wrap onto a second line, making the header taller: the form must still fit.
  for (const width of [1280, 1100]) {
    test(`the form scrolls on its own, so every section stays reachable beside long results (${width}px)`, async ({ calculator, page }) => {
      await page.setViewportSize({ width, height: 800 });
      await calculator.openAllSections();

      const panel = await calculator.formPanel.boundingBox();
      expect(panel!.height, 'the open form must fit in the window instead of running off the bottom').toBeLessThanOrEqual(800);

      await calculator.section('section-options').locator('summary').click();
      await expect(calculator.section('section-options'), 'the last section can be reached and toggled').not.toHaveAttribute('open');

      const after = await calculator.formPanel.boundingBox();
      expect(after!.y + after!.height, 'the bottom of the form is inside the window').toBeLessThanOrEqual(800);
      // At most the page header scrolls away (the panel then sticks); the long results are never scrolled through.
      expect(await calculator.windowScrollY(), 'reaching it scrolls the form, not the results').toBeLessThan(150);
    });
  }

  test('the form card ends level with the results', async ({ calculator, page }) => {
    const bottoms = async () => {
      const form = (await calculator.formPanel.boundingBox())!;
      const results = (await calculator.results.boundingBox())!;
      return [Math.round(form.y + form.height), Math.round(results.y + results.height)];
    };

    // A window tall enough for the whole Overview: level as soon as it opens.
    await page.setViewportSize({ width: 1440, height: 1500 });
    const [form, results] = await bottoms();
    expect(form, 'the cards end level when the results fit the window').toBe(results);

    // A shorter window: the form fits the window first, and ends level with the results once scrolled to the end.
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => {
      const [formAtEnd, resultsAtEnd] = await bottoms();
      return formAtEnd - resultsAtEnd;
    }, { message: 'the cards end level at the end of the page' }).toBe(0);
  });

  test('a 2-1 buydown: lower payments for two years, its cost, and the same loan underneath', async ({ calculator, page }) => {
    // $375,000 with 5% down at 5.99%: the reference buydown in tools/rate-check/rate_model.py.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.chooseRateType('buydown');
    await calculator.calculate();

    const plan = page.getByTestId('rate-plan');
    await expect(plan.locator('li'), 'each year, then the note rate').toHaveText([
      /Year 1\s*3\.99%\s*\$1,698\.74\/mo/, /Year 2\s*4\.99%\s*\$1,910\.25\/mo/, /From year 3\s*5\.99%\s*\$2,133\.61\/mo/,
    ]);
    await expect(page.getByTestId('buydown-cost'), 'what the subsidy costs').toContainText('$7,899');
    await expect(page.getByTestId('buydown-first-year'), 'the payment tile shows year 1').toBeVisible();
  });

  test('cash to close: the down payment, the fees, prepaid interest and escrow from the loan, credits, and a buydown you pay for', async ({ calculator, page }) => {
    // The example's $4,000 + $1,000 of fees, 15 days of interest and 3 months of escrow, on the reference buydown loan:
    // 356,250 × 5.99% ÷ 365 is $58.46 a day; (7,150 of tax + 2,400 of insurance) ÷ 12 is $795.83 a month.
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.calculate();
    const lines = page.getByTestId('cash-to-close');
    const total = page.getByTestId('cash-to-close-total');

    await expect(lines.locator('tbody th'), 'each line, with how prepaid interest and escrow are worked out').toHaveText([
      'Down payment', 'Loan costs', 'Other fees', /Prepaid interest\s*15 days at \$58\.46/, /Homeowners insurance\s*the first year/,
      /Escrow deposit\s*3 months at \$795\.83/,
    ]);
    await expect(total, '18,750 + 5,000 + 876.90 + 2,400 + 2,387.49').toHaveText('$29,414.39');

    await calculator.set('closing-credits', 3_000);
    await calculator.calculate();
    await expect(total, 'credits come off').toHaveText('$26,414.39');

    await calculator.chooseRateType('buydown');
    await page.getByTestId('buydown-paid-by-you').check();
    await calculator.calculate();
    await expect(total, 'a 2-1 buydown you pay for is paid at closing: $7,898.76 more').toHaveText('$34,313.15');
  });

  test('each buydown saves a different amount of interest when the seller pays, and none when you do', async ({ calculator, page }) => {
    // The same loan, with its $200 a month extra: the loan's interest is $316,575 whatever the buydown
    // (tools/calculator-check/calculator_model.py).
    await calculator.fillLoan({ homePrice: 375_000, downPayment: 18_750, rate: 5.99, years: 30, firstPayment: '2036-01-01' });
    await calculator.chooseRateType('buydown');
    await calculator.calculate();
    const note = page.getByTestId('interest-you-pay');

    await expect(calculator.totalInterest, 'the loan charges the same interest').toHaveText('$316,575');
    await expect(note, 'the seller pays by default, and a 2-1 pays $7,899 of it').toHaveText("The seller's buydown pays $7,899 of it, so you pay $308,676.");

    await page.getByTestId('buydown-plan').selectOption('3-2-1');
    await calculator.calculate();
    await expect(calculator.totalInterest, 'still the same loan underneath').toHaveText('$316,575');
    await expect(note, 'a 3-2-1 pays more of it').toHaveText("The seller's buydown pays $15,502 of it, so you pay $301,073.");

    await page.getByTestId('buydown-paid-by-you').check();
    await calculator.calculate();
    await expect(note, 'bought with your own money, it saves no interest').toHaveText('Your buydown, paid for at closing, lowers the early payments, not the interest.');
    await expect(page.getByTestId('buydown-cost'), 'it only moves your money earlier').toContainText('You pay $15,502 at closing');
  });

  test('a 7/1 adjustable rate: the reset, the new payment, and the worst case the caps allow', async ({ calculator, page }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.chooseRateType('arm');
    await calculator.set('arm-expected-rate', 7.5);
    await calculator.calculate();

    const plan = page.getByTestId('rate-plan');
    await expect(plan.locator('li'), 'seven years at 6%, then 7.5% re-amortized').toHaveText([
      /Jan 2036 to Dec 2042\s*6%\s*\$1,199\.10\/mo/, /From Jan 2043\s*7\.5%\s*\$1,365\.01\/mo/,
    ]);
    await expect(page.getByTestId('arm-worst-case'), '5/2/5 caps allow 11% at the first reset').toContainText('reaches 11% by Jan 2043 and the payment $1,787.42 a month');
  });

  test("an adjustable rate's margin is its floor: a falling rate stops there", async ({ calculator, page }) => {
    // 6% falling toward 2% within 2/2/5 caps: 4% at the first reset, then 2.75%, the margin, not 2%.
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.chooseRateType('arm');
    await calculator.set('arm-expected-rate', 2);
    await calculator.set('arm-initial-cap', 2);
    await calculator.set('arm-periodic-cap', 2);
    await calculator.calculate();

    await expect(page.getByTestId('rate-plan').locator('li'), 'down to the margin, and no further').toHaveText([
      /6%\s*\$1,199\.10\/mo/, /From Jan 2043\s*4%\s*\$994\.55\/mo/, /From Jan 2044\s*2\.75%\s*\$881\.34\/mo/,
    ]);
  });

  test('recalculates as you type, without a Calculate button', async ({ calculator }) => {
    await expect(calculator.calculateButton, 'there is no Calculate button any more').toHaveCount(0);

    await calculator.set('monthly-extra', 1_000);
    await calculator.calculate();

    await expect(calculator.timeSaved, 'a bigger extra payment saves more time').not.toHaveText('6 yr 1 mo');
  });

  test('takes the down payment as a percentage too', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.field('down-payment-mode-percent').check();

    await expect(calculator.field('down-payment'), '$50,000 of $250,000 converts to 20%').toHaveValue('20');
    await calculator.set('down-payment', 10);
    await calculator.calculate();

    await expect(calculator.field('loan-summary'), '10% of $250,000').toContainText('$25,000 down (10%)');
    await expect(calculator.monthlyPayment, '$225,000 at 6% over 30 years').toHaveText('$1,348.99');
  });

  test('without extra payments, leads with the total interest instead of a $0 saving', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.calculate();

    await expect(calculator.totalInterest, 'total interest on $200,000 at 6% over 30 years').toHaveText('$231,677');
    await expect(calculator.netSavings, 'no $0 savings headline').toBeHidden();
  });

  test('calculates interest savings for a recurring monthly extra payment', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(200);

    await calculator.calculate();

    await expect(calculator.monthlyPayment, '$200,000 at 6% over 30 years').toHaveText('$1,199.10');
    await expect(calculator.netSavings, 'interest saved by $200 a month').toHaveText('$79,801');
    await expect(calculator.timeSaved, '108 payments sooner').toHaveText('9 yr');
    await expect(calculator.payoffDate, 'payment 252').toHaveText('Dec 2056');
    await expect(calculator.totalInterest, 'the new total interest').toHaveText('$151,876');
    await calculator.showResults('schedule');
    await expect(calculator.scheduleRows, 'one row per payment').toHaveCount(252);
  });

  test('adds housing costs to the monthly payment but never counts them as savings', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.set('local-tax-rate', 2.1);
    await calculator.set('monthly-hoa', 75);
    await calculator.setExtras(200);

    await calculator.calculate();

    await expect(calculator.totalMonthlyPayment, '$1,199.10 + $437.50 tax + $75 HOA').toHaveText('$1,711.60');
    await expect(calculator.breakdownTotal, 'the breakdown agrees with the headline').toHaveText('$1,711.60');
    await expect(calculator.netSavings, 'taxes and dues continue after payoff, so savings are interest only').toHaveText('$79,801');
  });

  test('requested PMI removal: extra payments end PMI sooner and count as savings', async ({ calculator }) => {
    await calculator.fillLoan(FIVE_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.set('pmi-rate', 0.5);
    await calculator.choose('pmi-cancellation', 'BorrowerRequested');
    await calculator.setExtras(300);

    await calculator.calculate();

    await expect(calculator.pmiEnd, 'requested removal uses the actual balance: payment 62').toHaveText('Feb 2041');
    await expect(calculator.message('instead of Apr 2046'), 'instead of payment 124').toBeVisible();
    await expect(calculator.savingsDetail, 'the PMI saved is part of net savings').toContainText('+ $6,136 PMI');
  });

  test('automatic PMI removal follows the original schedule, so extra payments do not move it', async ({ calculator }) => {
    await calculator.fillLoan(FIVE_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.set('pmi-rate', 0.5);
    await calculator.setExtras(300);

    await calculator.calculate();

    await expect(calculator.pmiEnd, 'automatic removal stays at payment 135').toHaveText('Mar 2047');
    await expect(calculator.savingsDetail, 'so no PMI is saved: the savings are all interest, which the headline already says').toBeHidden();
  });

  test('applies the Texas school homestead exemption only to a homestead', async ({ calculator }) => {
    // $300,000 home, 1% school rate: homestead taxes $160,000 ($133.33/mo); otherwise $300,000 ($250.00/mo).
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);

    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax'), 'taxed on $160,000 as a homestead').toHaveText('$133.33');

    await calculator.setChecked('is-homestead', false);
    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax'), 'taxed on the full $300,000 otherwise').toHaveText('$250.00');
  });

  test('one property tax rate: the homestead exemption comes off the value, and the form says what it saves', async ({ calculator, page }) => {
    // $300,000 home at 2%: a homestead pays on $250,000 ($5,000 a year, $416.67 a month); without it, on all of it ($500.00).
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('property-tax-rate', 2);
    await calculator.set('homestead-exemption', 50_000);

    await calculator.calculate();
    await expect(calculator.breakdownAmount('Property tax'), 'taxed on $250,000 as a homestead').toHaveText('$416.67');
    await expect(page.getByTestId('homestead-savings'), 'the exemption saves 2% of $50,000').toHaveText('In year 1 the exemption saves $1,000 in tax.');

    await calculator.setChecked('is-homestead', false);
    await calculator.calculate();
    await expect(calculator.breakdownAmount('Property tax'), 'taxed on the full $300,000 otherwise').toHaveText('$500.00');
  });

  test('each homestead exemption lowers its own tax, and the form says what they save', async ({ calculator, page }) => {
    // $300,000 home: school 1% with $140,000 exempt; county/city 1% with 20% exempt; MUD 1% with 10% exempt.
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('local-tax-rate', 1);
    await calculator.set('mud-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);
    await calculator.set('local-exemption', 20);
    await calculator.set('mud-exemption', 10);

    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax'), 'school: taxed on $160,000').toHaveText('$133.33');
    await expect(calculator.breakdownAmount('County & city tax'), 'county/city: taxed on $240,000').toHaveText('$200.00');
    await expect(calculator.breakdownAmount('MUD tax'), 'MUD: taxed on $270,000').toHaveText('$225.00');
    await expect(page.getByTestId('homestead-savings'), 'the form sums up what the exemptions save')
      .toHaveText('In year 1 these save $2,300 in tax: school $1,400 · county/city $600 · MUD $300.');
  });

  test('over 65: adds the extra school exemption and freezes school tax', async ({ calculator }) => {
    // $300,000 home, 1% school rate: ($300,000 - $140,000 - $60,000) x 1% = $1,000 a year = $83.33 a month.
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);
    await calculator.set('home-value-growth', 10);
    await calculator.setChecked('is-over-65', true);
    await calculator.set('over-65-year', 1);
    await calculator.set('over-65-school-exemption', 60_000);

    await calculator.calculate();

    await expect(calculator.breakdownAmount('School tax'), '$140,000 + $60,000 exempt').toHaveText('$83.33');
    await calculator.showYearlyCosts();
    await expect(calculator.projectionNote, 'values rise 10% a year, but the ceiling holds the tax flat')
      .toContainText('go from $1,000 in year 1 to $1,000 in year 30');
  });

  test('projects yearly costs and shows the appraisal cap holding taxable value down', async ({ calculator }) => {
    await calculator.set('home-value-growth', 15);
    await calculator.set('assessment-cap', 10);
    await calculator.calculate();
    await calculator.showYearlyCosts();

    await expect(calculator.projectionChart, 'the projection chart renders').toBeVisible();
    await expect(calculator.projectionNote, 'the costs view summarizes the change').toContainText('Yearly taxes & costs go from');

    await calculator.showHomeValueProjection();
    await expect(calculator.homeValueNote, 'a 15% market against a 10% cap opens a gap').toContainText('the homestead cap keeps');
  });

  test('gives the quick numbers for any year, from the same figures as the chart', async ({ calculator, page }) => {
    // A fresh calculation, so the test has the very response the page shows.
    const answer = page.waitForResponse((r) => r.url().includes('/api/v1/amortization/calculate') && r.ok());
    await calculator.set('home-price', 400_000);
    const projection: { costs: { total: number } }[] = (await (await answer).json()).projection;
    await calculator.calculate();
    await calculator.showResults('projection');
    const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    const sum = (years: { costs: { total: number } }[]) => years.reduce((s, y) => s + y.costs.total, 0);
    const total = page.getByTestId('cost-totals-total');

    await page.getByTestId('cost-totals-year').selectOption('10');

    await expect(page.getByTestId('cost-totals').locator('thead th'), 'the year, everything through it, and the whole loan')
      .toHaveText(['Cost', /^Year 10 \(\d{4}\)$/, 'Through year 10', 'All 30 years']);
    await expect(total.locator('td').nth(0), "year 10's costs, and a month of them").toContainText(usd(projection[9].costs.total));
    await expect(total.locator('td').nth(1), 'years 1 to 10 added up').toHaveText(usd(sum(projection.slice(0, 10))));
    await expect(total.locator('td').nth(2), 'all 30 years added up').toHaveText(usd(sum(projection)));

    // A click on the chart (through the locator, which scrolls it into view) picks that year for the numbers.
    const chart = (await calculator.projectionChart.boundingBox())!;
    await calculator.projectionChart.click({ position: { x: chart.width / 2, y: chart.height / 2 } });
    await expect(page.getByTestId('cost-totals-year'), 'a year in the middle of the loan is picked').not.toHaveValue('10');
    const picked = await page.getByTestId('cost-totals-year').inputValue();
    await expect(page.getByTestId('cost-totals').locator('thead th').nth(2), 'and the numbers follow it').toHaveText(`Through year ${picked}`);
  });

  test('splits the results into tabs with their own URLs, and keeps the form as it was', async ({ calculator, page }) => {
    await calculator.set('home-price', 300_000);
    await calculator.calculate();
    await expect(page, 'the calculator opens on the overview').toHaveURL(/\/calculator\/overview$/);

    await calculator.showResults('projection');
    await expect(calculator.projectionChart, 'the projection tab shows the yearly costs').toBeVisible();
    await expect(calculator.chart, 'and not the overview charts').toHaveCount(0);
    await expect(calculator.field('home-price'), 'the form is unchanged').toHaveValue('300,000');

    await page.goBack();
    await expect(page, 'the back button returns to the overview').toHaveURL(/\/calculator\/overview$/);
    await expect(calculator.chart, 'with its balance chart').toBeVisible();
  });

  test('fits the result tabs without a scrollbar of their own', async ({ calculator, page }) => {
    await expect(calculator.results, 'the calculator is open').toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Results' });

    // Headless Chromium hides scrollbars, so check the cause: content taller than the strip, with
    // vertical scrolling allowed, is what puts up/down arrows next to the tabs on Windows.
    const canScrollVertically = await tabs.evaluate(
      (nav) => nav.scrollHeight > nav.clientHeight && getComputedStyle(nav).overflowY !== 'hidden');
    expect(canScrollVertically, 'the tab strip never scrolls up and down').toBe(false);
  });

  test('shows no PMI with 20% down', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.calculate();

    await expect(calculator.pmiHint, 'the form explains why there is no PMI').toContainText('No PMI');
    await expect(calculator.pmiEnd, 'and the PMI tile disappears').toBeHidden();
  });

  test('recasts after a qualifying lump sum: same payoff date, lower payment, fee charged', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.addLumpSum(50_000, 12);
    await calculator.chooseRecast(10_000, 250);

    await calculator.calculate();

    await expect(calculator.recasts, 're-amortized over the remaining 348 months').toContainText('payment drops from $1,199.10 to $895.60');
    await expect(calculator.recasts, 'the lender fee is shown').toContainText('$250 fee');
    await expect(calculator.samePayoff, 'a recast keeps the payoff date').toHaveText('Same date: a recast lowers the payment instead');
    await calculator.showResults('schedule');
    await expect(calculator.scheduleRows, 'all 360 payments remain').toHaveCount(360);
    await expect(await calculator.cell(12, 'Extra'), 'the triggering payment is tagged').toContainText('recast');
    await expect(await calculator.cell(13, 'Payment'), 'the next payment is the new amount').toHaveText('$895.60');
  });

  test('does not recast a lump sum below the lender minimum', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.addLumpSum(9_000, 12);
    await calculator.chooseRecast(10_000, 250);

    await calculator.calculate();

    await expect(calculator.recasts, '$9,000 is below the $10,000 minimum').toBeHidden();
    await expect(await calculator.cell(13, 'Payment'), 'the payment is unchanged').toHaveText('$1,199.10');
    await expect(calculator.scheduleRows, 'the lump sum shortens the term instead').not.toHaveCount(360);
  });

  test('applies a lump sum on the chosen payment', async ({ calculator }) => {
    await calculator.fillLoan({ homePrice: 125_000, downPayment: 25_000, rate: 5, years: 15 });
    await calculator.setExtras(0);
    await calculator.addLumpSum(25_000, 12);

    await calculator.calculate();

    await expect(await calculator.cell(12, 'Extra'), 'the lump sum lands on payment 12').toHaveText('$25,000.00');
    await expect(await calculator.cell(11, 'Extra'), 'and nowhere else').toHaveText('—');
  });

  test('shows amounts with thousands separators, and the plain number while editing', async ({ calculator }) => {
    await calculator.set('home-price', 250000);
    await calculator.field('interest-rate').click(); // move on, as a user would

    await expect(calculator.field('home-price'), 'formatted once editing ends').toHaveValue('250,000');

    await calculator.field('home-price').click();
    await expect(calculator.field('home-price'), 'plain while editing, so the caret never jumps').toHaveValue('250000');
  });

  test('can roll the schedule up into one row per year', async ({ calculator }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.setExtras(0);
    await calculator.calculate();

    await calculator.showYearlySchedule();

    await expect(calculator.scheduleRows, 'a 30-year loan has 30 yearly rows').toHaveCount(30);
    await expect(await calculator.cell(1, 'Starts'), 'year 1 starts in 2036').toHaveText('2036');
    await expect(await calculator.cell(30, 'Balance'), 'the loan ends at zero').toHaveText('$0.00');
  });

  test('totals every cost over the whole schedule, and lets you add each as a column', async ({ calculator, page }) => {
    await calculator.showResults('schedule');
    const totals = page.getByTestId('lifetime-totals');
    await expect(totals, 'the lifetime totals include the tax').toContainText('Property tax');
    await expect(totals, 'and what everything adds up to').toContainText('Everything paid');
    await expect(page.getByRole('columnheader', { name: 'Property tax' }), 'categories start rolled up into Housing costs').toHaveCount(0);

    await page.getByTestId('column-picker').locator('summary').click();
    await page.getByRole('checkbox', { name: 'Property tax' }).check();

    await expect(page.getByRole('columnheader', { name: 'Property tax' }), 'the chosen column appears').toBeVisible();
    await calculator.showResults('overview');
    await calculator.showResults('schedule');
    await expect(page.getByRole('columnheader', { name: 'Property tax' }), 'and the choice is remembered').toBeVisible();
  });

  test('can switch the table to the standard schedule', async ({ calculator }) => {
    await calculator.showStandardSchedule();

    await expect(calculator.scheduleRows, 'the standard schedule runs the full term').toHaveCount(360);
  });

  test('never sends invalid input to the API, and explains the problem', async ({ calculator }) => {
    const apiWasCalled = calculator.watchApiCalls();

    await calculator.set('interest-rate', 45);
    await calculator.set('down-payment', 400_000);

    await expect(calculator.formPanel.getByText('Interest rate must be between 0% and 30%.'), 'the rate error is shown on the field').toBeVisible();
    await expect(calculator.formPanel.getByText('The down payment must be less than the home price.'), 'the down payment error is shown').toBeVisible();
    await expect(calculator.staleResults.locator('li'), 'the results say they are for the last valid inputs, and why')
      .toHaveText(['Interest rate must be between 0% and 30%.', 'The down payment must be less than the home price.']);
    await calculator.waitPastRecalculationPause();
    expect(apiWasCalled(), 'invalid input must not reach the API').toBe(false);
  });

  test('shows server validation messages', async ({ calculator }) => {
    // The client rules mirror the server's, so a real 400 is hard to trigger from the UI.
    // Mock one to prove ProblemDetails responses reach the user.
    await calculator.rejectCalculationsWith({
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { 'extraPayments.lumpSums[0].amount': ["'Lump sum' cannot exceed the loan amount."] },
    });

    await calculator.set('monthly-extra', 250);

    await expect(calculator.errorSummary, 'the server message is shown to the user').toContainText("'Lump sum' cannot exceed the loan amount.");
  });

  test('recovers after a failed request', async ({ calculator, page }) => {
    await calculator.failNextCalculation();
    await calculator.set('monthly-extra', 250);
    await expect(calculator.errorSummary, 'a network failure is explained').toContainText("couldn't reach the server");

    await page.getByTestId('retry').click();

    await expect(calculator.errorSummary, 'trying again clears the error').toBeHidden();
    await expect(calculator.monthlyPayment, 'and results show again').toBeVisible();
  });
});

test.describe('On a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows the answer first, above the form', async ({ calculator }) => {
    await expect(calculator.headline, 'the headline numbers are on screen without scrolling').toBeInViewport();

    const headline = await calculator.headline.boundingBox();
    const form = await calculator.formPanel.boundingBox();
    expect(headline!.y, 'the headline sits above the form').toBeLessThan(form!.y);
  });

  test('one tap takes you from the answer to the form below it', async ({ calculator, page }) => {
    await expect(calculator.formPanel, 'the form starts below the results').not.toBeInViewport();

    await page.getByTestId('edit-inputs').click();

    await expect(calculator.formPanel, 'the form is brought into view').toBeInViewport();
    await expect(calculator.formPanel, 'and focus goes with it, for keyboard and screen-reader users').toBeFocused();
  });

  test('keeps the header to two short rows, with the page links on one line', async ({ calculator, page }) => {
    await expect(calculator.headline, 'the page has loaded').toBeVisible();
    const header = await page.locator('.app-header').boundingBox();
    const links = page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: /Calculator|Refinance|History/ });
    const tops = await links.evaluateAll((all) => all.map((a) => Math.round(a.getBoundingClientRect().top)));

    expect(header!.height, 'the name and Sign in, then the page links: not four rows').toBeLessThan(110);
    expect(new Set(tops).size, 'the page links share one line, which scrolls sideways').toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the page itself never scrolls sideways').toBeLessThanOrEqual(390);
  });

  test('hides the summary bar while the headline numbers are on screen', async ({ calculator }) => {
    await expect(calculator.headline, 'the headline is in view at the top').toBeInViewport();
    await expect(calculator.summaryBar, 'so the bar would only repeat it').toBeHidden();
  });

  test('keeps the payment and savings in view while editing', async ({ calculator }) => {
    await calculator.set('monthly-extra', 500);
    await calculator.calculate();

    await expect(calculator.summaryBar, 'the summary bar shows on small screens').toBeVisible();
    await expect(calculator.summaryBar, 'it shows the monthly payment').toContainText('/mo');
    await expect(calculator.summaryBar, 'and the savings').toContainText('Net savings $');
    await expect(calculator.summaryBar, 'it stays pinned in view while the form scrolls').toBeInViewport();
  });
});

test('spaces the overview evenly: no empty row adds a second gap above the charts', async ({ calculator, page }) => {
  const headline = await calculator.headline.boundingBox();
  const charts = await page.locator('app-overview-tab .charts').boundingBox();

  expect(charts!.y - (headline!.y + headline!.height), 'one 1.25rem gap between the headline and the charts, for a fixed-rate loan')
    .toBeLessThanOrEqual(21);
});

test('hides the phone summary bar on a desktop, where the tiles are in view', async ({ calculator }) => {
  await expect(calculator.summaryBar, 'desktop shows the tiles instead').toBeHidden();
});

test('serves interactive API documentation', async ({ page }) => {
  await page.goto('/swagger');

  await expect(page.getByRole('heading', { name: /Mortgage Analytics API/ }), 'Swagger UI loads').toBeVisible();
  await expect(page.getByText('/api/v1/amortization/calculate'), 'the endpoint is listed').toBeVisible();
});
