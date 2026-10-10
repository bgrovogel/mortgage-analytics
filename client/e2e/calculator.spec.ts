import { API_URL } from './env';
import { expect, test } from './fixtures';

/** $250,000 home with 20% down: a $200,000 loan at 6%, whose reference values the unit tests verify. */
const TWENTY_PERCENT_DOWN = { homePrice: 250_000, downPayment: 50_000, rate: 6, years: 30, firstPayment: '2026-01-01' };

/** The same home with 5% down at 6.5%, which needs PMI. */
const FIVE_PERCENT_DOWN = { homePrice: 250_000, downPayment: 12_500, rate: 6.5, years: 30, firstPayment: '2026-01-01' };

test.describe('Mortgage calculator', () => {
  test('shows a worked example with taxes, insurance and PMI on first load', async ({ calculator }) => {
    await expect(calculator.breakdown, 'the breakdown starts with principal and interest').toContainText('Principal & interest');
    await expect(calculator.breakdown, 'the default example includes MUD tax').toContainText('MUD tax');
    await expect(calculator.breakdown, 'the default example has 5% down, so PMI').toContainText('PMI');
    await expect(calculator.pmiEnd, 'the PMI end date is shown when PMI applies').toBeVisible();
    await expect(calculator.chart, 'the balance chart renders').toBeVisible();
    await expect(calculator.scheduleRows.first(), 'the schedule table has rows').toBeVisible();
  });

  test('keeps advanced options collapsed, each summarized in one line', async ({ calculator }) => {
    for (const id of ['section-taxes', 'section-costs', 'section-growth', 'section-options']) {
      await expect(calculator.section(id), `${id} should start closed`).not.toHaveAttribute('open');
    }
    await expect(calculator.sectionSummary('taxes-summary'), 'a closed section summarizes its values')
      .toHaveText('School 1% · County/city 1.1% · MUD 0.85% · Homestead');
    await expect(calculator.field('school-tax-rate'), 'fields inside a closed section are hidden').toBeHidden();

    await calculator.openSection('section-taxes');

    await expect(calculator.field('school-tax-rate'), 'opening the section reveals its fields').toBeVisible();
  });

  test('the form scrolls on its own, so every section stays reachable beside long results', async ({ calculator, page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
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
    await expect(calculator.payoffDate, 'payment 252').toHaveText('Dec 2046');
    await expect(calculator.scheduleRows, 'one row per payment').toHaveCount(252);
    await expect(calculator.totalInterest, 'the new total interest').toHaveText('$151,876');
  });

  test('adds taxes and fees to the monthly payment but never counts them as savings', async ({ calculator }) => {
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

    await expect(calculator.pmiEnd, 'requested removal uses the actual balance: payment 62').toHaveText('Feb 2031');
    await expect(calculator.message('instead of Apr 2036'), 'instead of payment 124').toBeVisible();
    await expect(calculator.savingsDetail, 'the PMI saved is part of net savings').toContainText('+ $6,136 PMI');
  });

  test('automatic PMI removal follows the original schedule, so extra payments do not move it', async ({ calculator }) => {
    await calculator.fillLoan(FIVE_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.set('pmi-rate', 0.5);
    await calculator.setExtras(300);

    await calculator.calculate();

    await expect(calculator.pmiEnd, 'automatic removal stays at payment 135').toHaveText('Mar 2037');
    await expect(calculator.savingsDetail, 'so no PMI is saved').not.toContainText('PMI');
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
    await expect(calculator.projectionNote, 'values rise 10% a year, but the ceiling holds the tax flat')
      .toContainText('go from $1,000 in year 1 to $1,000 in year 30');
  });

  test('projects yearly costs and shows the appraisal cap holding taxable value down', async ({ calculator }) => {
    await calculator.set('home-value-growth', 15);
    await calculator.set('assessment-cap', 10);
    await calculator.calculate();

    await expect(calculator.projectionChart, 'the projection chart renders').toBeVisible();
    await expect(calculator.projectionNote, 'the costs view summarizes the change').toContainText('Yearly taxes & costs go from');

    await calculator.showHomeValueProjection();
    await expect(calculator.projectionNote, 'a 15% market against a 10% cap opens a gap').toContainText('the homestead cap keeps');
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
    await expect(calculator.timeSaved, 'a recast keeps the payoff date').toHaveText('0 mo');
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
    await expect(await calculator.cell(1, 'Starts'), 'year 1 starts in 2026').toHaveText('2026');
    await expect(await calculator.cell(30, 'Balance'), 'the loan ends at zero').toHaveText('$0.00');
  });

  test('can switch the table to the standard schedule', async ({ calculator }) => {
    await calculator.showStandardSchedule();

    await expect(calculator.scheduleRows, 'the standard schedule runs the full term').toHaveCount(360);
  });

  test('never sends invalid input to the API, and explains the problem', async ({ calculator }) => {
    const apiWasCalled = calculator.watchApiCalls();

    await calculator.set('interest-rate', 45);
    await calculator.set('down-payment', 400_000);

    await expect(calculator.message('Rate must be between 0% and 30%.'), 'the rate error is shown').toBeVisible();
    await expect(calculator.message('The down payment must be less than the home price.'), 'the down payment error is shown').toBeVisible();
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

  test('recovers after a failed request', async ({ calculator }) => {
    await calculator.failNextCalculation();
    await calculator.set('monthly-extra', 250);
    await expect(calculator.errorSummary, 'a network failure is explained').toContainText('could not be reached');

    await calculator.set('monthly-extra', 300);
    await calculator.calculate();

    await expect(calculator.errorSummary, 'the next success clears the error').toBeHidden();
    await expect(calculator.monthlyPayment, 'and results show again').toBeVisible();
  });
});

test.describe('On a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the payment and savings in view while editing', async ({ calculator }) => {
    await calculator.set('monthly-extra', 500);
    await calculator.calculate();

    await expect(calculator.summaryBar, 'the summary bar shows on small screens').toBeVisible();
    await expect(calculator.summaryBar, 'it shows the monthly payment').toContainText('/mo');
    await expect(calculator.summaryBar, 'and the savings').toContainText('Save $');
    await expect(calculator.summaryBar, 'it stays pinned in view while the form scrolls').toBeInViewport();
  });
});

test('hides the phone summary bar on a desktop, where the tiles are in view', async ({ calculator }) => {
  await expect(calculator.summaryBar, 'desktop shows the tiles instead').toBeHidden();
});

test('serves interactive API documentation', async ({ page }) => {
  await page.goto(`${API_URL}/swagger`);

  await expect(page.getByRole('heading', { name: /Mortgage Analytics API/ }), 'Swagger UI loads').toBeVisible();
  await expect(page.getByText('/api/v1/amortization/calculate'), 'the endpoint is listed').toBeVisible();
});
