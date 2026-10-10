import { Locator, Page, expect } from '@playwright/test';

/** The inputs a test can set. Anything left out keeps the form's default. */
export interface LoanInput {
  homePrice: number;
  downPayment: number;
  rate: number;
  years: number;
  firstPayment?: string;
}

/**
 * Page object: tests describe intent ("fill the loan"); selectors and the mechanics of the page
 * (collapsed sections, recalculating as you type) live here, in one place.
 */
export class CalculatorPage {
  readonly homePrice: Locator;
  readonly downPayment: Locator;
  readonly interestRate: Locator;
  readonly monthlyExtra: Locator;
  readonly results: Locator;
  readonly totalMonthlyPayment: Locator;
  readonly monthlyPayment: Locator;
  readonly netSavings: Locator;
  readonly timeSaved: Locator;
  readonly payoffDate: Locator;
  readonly pmiEnd: Locator;
  readonly recasts: Locator;
  readonly breakdown: Locator;
  readonly chart: Locator;
  readonly scheduleRows: Locator;
  readonly errorSummary: Locator;
  readonly summaryBar: Locator;

  constructor(private readonly page: Page) {
    this.homePrice = page.getByTestId('home-price');
    this.downPayment = page.getByTestId('down-payment');
    this.interestRate = page.getByTestId('interest-rate');
    this.monthlyExtra = page.getByTestId('monthly-extra');
    this.results = page.getByTestId('results');
    this.totalMonthlyPayment = page.getByTestId('total-monthly-payment');
    this.monthlyPayment = page.getByTestId('monthly-payment');
    this.netSavings = page.getByTestId('net-savings');
    this.timeSaved = page.getByTestId('time-saved');
    this.payoffDate = page.getByTestId('payoff-date');
    this.pmiEnd = page.getByTestId('pmi-end');
    this.recasts = page.getByTestId('recasts');
    this.breakdown = page.getByTestId('payment-breakdown');
    this.chart = page.getByTestId('balance-chart');
    this.scheduleRows = page.getByTestId('schedule-table').locator('tbody tr');
    this.errorSummary = page.getByTestId('error-summary');
    this.summaryBar = page.getByTestId('summary-bar');
  }

  /** Opens the app and waits for the first (automatic) calculation to render. */
  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.monthlyPayment, 'the default example should calculate on load').toBeVisible();
    await this.calculate();
  }

  /** A collapsible form section, e.g. "section-taxes". */
  section(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** Types a value into a field, opening its collapsed section first if it is inside one. */
  async set(testId: string, value: number | string): Promise<void> {
    const field = await this.reveal(testId);
    await field.fill(String(value));
  }

  /** Ticks or unticks a checkbox, opening its section first. */
  async setChecked(testId: string, checked: boolean): Promise<void> {
    const box = await this.reveal(testId);
    await box.setChecked(checked);
  }

  /** Chooses an option in a select, opening its section first. */
  async choose(testId: string, value: string): Promise<void> {
    const select = await this.reveal(testId);
    await select.selectOption(value);
  }

  /** Fills the purchase and loan fields. */
  async fillLoan(loan: LoanInput): Promise<void> {
    await this.set('home-price', loan.homePrice);
    await this.set('down-payment', loan.downPayment);
    await this.set('interest-rate', loan.rate);
    await this.set('term-years', loan.years);
    if (loan.firstPayment) {
      await this.set('first-payment-date', loan.firstPayment);
    }
  }

  /** Zeroes every tax, insurance and fee field, leaving principal and interest only. */
  async clearHousingCosts(): Promise<void> {
    for (const id of ['school-tax-rate', 'property-tax-rate', 'mud-tax-rate', 'pid-annual', 'annual-insurance', 'monthly-hoa', 'pmi-rate']) {
      await this.set(id, 0);
    }
  }

  /** Sets the monthly and annual extra payments; lump sums are added separately. */
  async setExtras(monthly: number, annual = 0): Promise<void> {
    await this.set('monthly-extra', monthly);
    await this.set('annual-extra', annual);
  }

  /** Adds a lump-sum row and fills it. */
  async addLumpSum(amount: number, paymentNumber: number): Promise<void> {
    await (await this.reveal('add-lump-sum')).click();
    const row = this.page.getByTestId('lump-sum').last();
    await row.getByLabel('Lump sum ($)').fill(String(amount));
    await row.getByLabel('With payment #').fill(String(paymentNumber));
  }

  /** Chooses the recast strategy and sets the lender's terms. */
  async chooseRecast(minimumLumpSum = 10_000, fee = 250): Promise<void> {
    await (await this.reveal('strategy-recast')).check();
    await this.set('recast-minimum', minimumLumpSum);
    await this.set('recast-fee', fee);
  }

  /**
   * Waits until the results reflect the latest input. The page recalculates by itself after a short
   * pause; the results region is aria-busy from the first change until the answer arrives.
   */
  async calculate(): Promise<void> {
    await expect(this.results, 'results should finish updating').toHaveAttribute('aria-busy', 'false');
  }

  /** Makes the next calculation fail as if the network were down; later ones go through normally. */
  failNextCalculation(): Promise<void> {
    return this.page.route('**/api/v1/amortization/calculate', (route) => route.abort(), { times: 1 });
  }

  /** Switches the table to the standard (no extra payments) schedule. */
  showStandardSchedule(): Promise<void> {
    return this.page.getByTestId('view-baseline').click();
  }

  /** Returns the monthly amount shown for a category in the payment breakdown, e.g. "School tax". */
  breakdownAmount(label: string): Locator {
    return this.breakdown.locator('tr', { hasText: label }).locator('td').first();
  }

  /** Returns one cell in the schedule table. */
  cell(paymentNumber: number, column: number): Locator {
    return this.scheduleRows.nth(paymentNumber - 1).locator('td').nth(column);
  }

  /** Returns the element, first opening the collapsed section that contains it (if any). */
  private async reveal(testId: string): Promise<Locator> {
    const element = this.page.getByTestId(testId);
    const section = element.locator('xpath=ancestor::details');
    if ((await section.count()) > 0 && !(await section.evaluate((d: HTMLDetailsElement) => d.open))) {
      await section.locator('summary').click();
    }
    return element;
  }
}
