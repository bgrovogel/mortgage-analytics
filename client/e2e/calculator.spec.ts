import { expect, test } from '@playwright/test';
import { CalculatorPage } from './calculator.page';

/** $250,000 home with 20% down: a $200,000 loan at 6%, whose reference values the unit tests verify. */
const TWENTY_PERCENT_DOWN = { homePrice: 250_000, downPayment: 50_000, rate: 6, years: 30, firstPayment: '2026-01-01' };

/** The same home with 5% down at 6.5%, which needs PMI. */
const FIVE_PERCENT_DOWN = { homePrice: 250_000, downPayment: 12_500, rate: 6.5, years: 30, firstPayment: '2026-01-01' };

test.describe('Mortgage calculator', () => {
  let calculator: CalculatorPage;

  test.beforeEach(async ({ page }) => {
    calculator = new CalculatorPage(page);
    await calculator.open();
  });

  test('shows a worked example with taxes, insurance and PMI on first load', async () => {
    await expect(calculator.breakdown).toContainText('Principal & interest');
    await expect(calculator.breakdown).toContainText('MUD tax');
    await expect(calculator.breakdown).toContainText('PMI');
    await expect(calculator.pmiEnd).toBeVisible();
    await expect(calculator.chart).toBeVisible();
    await expect(calculator.scheduleRows.first()).toBeVisible();
  });

  test('calculates interest savings for a recurring monthly extra payment', async () => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(200);

    await calculator.calculate();

    await expect(calculator.monthlyPayment).toHaveText('$1,199.10');
    await expect(calculator.netSavings).toHaveText('$79,801');
    await expect(calculator.timeSaved).toHaveText('9 yr');
    await expect(calculator.payoffDate).toHaveText('Dec 2046');
    await expect(calculator.scheduleRows).toHaveCount(252);
  });

  test('adds taxes and fees to the monthly payment but never counts them as savings', async ({ page }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await page.getByTestId('property-tax-rate').fill('2.1');
    await page.getByTestId('monthly-hoa').fill('75');
    await calculator.setExtras(200);

    await calculator.calculate();

    // $1,199.10 + $437.50 tax + $75 HOA. Savings are still interest only.
    await expect(calculator.totalMonthlyPayment).toHaveText('$1,711.60');
    await expect(page.getByTestId('breakdown-total')).toHaveText('$1,711.60');
    await expect(calculator.netSavings).toHaveText('$79,801');
  });

  test('ends PMI sooner with extra payments and counts it as savings', async ({ page }) => {
    await calculator.fillLoan(FIVE_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await page.getByTestId('pmi-rate').fill('0.5');
    await calculator.setExtras(300);

    await calculator.calculate();

    await expect(calculator.pmiEnd).toHaveText('Sep 2031');
    await expect(page.getByText('instead of Mar 2037')).toBeVisible();
    await expect(page.getByTestId('savings-detail')).toContainText('+ $6,531 PMI');
  });

  test('applies the Texas school homestead exemption only to a homestead', async ({ page }) => {
    // $300,000 home, 1% school rate: homestead taxes $160,000 ($133.33/mo); otherwise $300,000 ($250.00/mo).
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);

    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax')).toHaveText('$133.33');

    await page.getByTestId('is-homestead').uncheck();
    await calculator.calculate();
    await expect(calculator.breakdownAmount('School tax')).toHaveText('$250.00');
  });

  test('over 65: adds the extra school exemption and freezes school tax', async ({ page }) => {
    // $300,000 home, 1% school rate: ($300,000 - $140,000 - $60,000) x 1% = $1,000 a year = $83.33 a month.
    await calculator.fillLoan({ homePrice: 300_000, downPayment: 60_000, rate: 6, years: 30 });
    await calculator.clearHousingCosts();
    await calculator.set('school-tax-rate', 1);
    await calculator.set('school-exemption', 140_000);
    await calculator.set('home-value-growth', 10);
    await page.getByTestId('is-over-65').check();
    await calculator.set('over-65-year', 1);
    await calculator.set('over-65-school-exemption', 60_000);

    await calculator.calculate();

    await expect(calculator.breakdownAmount('School tax')).toHaveText('$83.33');
    // Values rise 10% a year, but the ceiling holds yearly costs flat from year 1 to year 30.
    await expect(page.getByTestId('projection-note')).toContainText('go from $1,000 in year 1 to $1,000 in year 30');
  });

  test('projects yearly costs and shows the appraisal cap holding taxable value down', async ({ page }) => {
    await calculator.set('home-value-growth', 15);
    await calculator.set('assessment-cap', 10);
    await calculator.calculate();

    await expect(page.getByTestId('projection-chart')).toBeVisible();
    await expect(page.getByTestId('projection-note')).toContainText('Yearly taxes & costs go from');

    await page.getByTestId('projection-value').click();
    await expect(page.getByTestId('projection-note')).toContainText('the homestead cap keeps');
  });

  test('shows no PMI with 20% down', async ({ page }) => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.calculate();

    await expect(page.getByTestId('pmi-hint')).toContainText('No PMI');
    await expect(calculator.pmiEnd).toBeHidden();
  });

  test('recasts after a qualifying lump sum: same payoff date, lower payment, fee charged', async () => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.addLumpSum(50_000, 12);
    await calculator.chooseRecast(10_000, 250);

    await calculator.calculate();

    await expect(calculator.recasts).toContainText('payment drops from $1,199.10 to $895.60');
    await expect(calculator.recasts).toContainText('$250 fee');
    await expect(calculator.timeSaved).toHaveText('0 mo');
    await expect(calculator.scheduleRows).toHaveCount(360);
    await expect(calculator.cell(12, 5)).toContainText('recast');
    await expect(calculator.cell(13, 2)).toHaveText('$895.60');
  });

  test('does not recast a lump sum below the lender minimum', async () => {
    await calculator.fillLoan(TWENTY_PERCENT_DOWN);
    await calculator.clearHousingCosts();
    await calculator.setExtras(0);
    await calculator.addLumpSum(9_000, 12);
    await calculator.chooseRecast(10_000, 250);

    await calculator.calculate();

    await expect(calculator.recasts).toBeHidden();
    await expect(calculator.cell(13, 2)).toHaveText('$1,199.10');
    await expect(calculator.scheduleRows).not.toHaveCount(360);
  });

  test('applies a lump sum on the chosen payment', async () => {
    await calculator.fillLoan({ homePrice: 125_000, downPayment: 25_000, rate: 5, years: 15 });
    await calculator.setExtras(0);
    await calculator.addLumpSum(25_000, 12);

    await calculator.calculate();

    await expect(calculator.cell(12, 5)).toHaveText('$25,000.00');
    await expect(calculator.cell(11, 5)).toHaveText('—');
  });

  test('can switch the table to the standard schedule', async () => {
    await calculator.showStandardSchedule();

    await expect(calculator.scheduleRows).toHaveCount(360);
  });

  test('blocks invalid input in the browser before calling the API', async ({ page }) => {
    let apiCalled = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/')) apiCalled = true;
    });

    await calculator.interestRate.fill('45');
    await calculator.downPayment.fill('400000');
    await calculator.calculateButton.click();

    await expect(page.getByText('Rate must be between 0% and 30%.')).toBeVisible();
    await expect(page.getByText('The down payment must be less than the home price.')).toBeVisible();
    expect(apiCalled).toBe(false);
  });

  test('shows server validation messages', async ({ page }) => {
    // The client rules mirror the server's, so a real 400 is hard to trigger from the UI.
    // Mock one to prove ProblemDetails responses reach the user.
    await page.route('**/api/v1/amortization/calculate', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: { 'extraPayments.lumpSums[0].amount': ["'Amount' cannot exceed the loan amount."] },
        }),
      }),
    );

    await calculator.calculateButton.click();

    await expect(calculator.errorSummary).toContainText("'Amount' cannot exceed the loan amount.");
  });

  test('recovers after a failed request', async ({ page }) => {
    await page.route('**/api/v1/amortization/calculate', (route) => route.abort(), { times: 1 });
    await calculator.calculateButton.click();
    await expect(calculator.errorSummary).toContainText('could not be reached');

    await calculator.calculate();

    await expect(calculator.errorSummary).toBeHidden();
    await expect(calculator.monthlyPayment).toBeVisible();
  });
});

test('serves interactive API documentation', async ({ page }) => {
  await page.goto('http://localhost:5080/swagger');

  await expect(page.getByRole('heading', { name: /Mortgage Analytics API/ })).toBeVisible();
  await expect(page.getByText('/api/v1/amortization/calculate')).toBeVisible();
});
