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
 * Page object: tests describe intent ("fill the loan"); every selector, and the mechanics of the page
 * (collapsed sections, recalculating as you type), live here in one place.
 */
export class CalculatorPage {
  // Results
  readonly results: Locator;
  readonly totalMonthlyPayment: Locator;
  readonly monthlyPayment: Locator;
  readonly netSavings: Locator;
  readonly totalInterest: Locator;
  readonly savingsDetail: Locator;
  readonly timeSaved: Locator;
  readonly payoffDate: Locator;
  readonly pmiEnd: Locator;
  readonly recasts: Locator;
  readonly breakdown: Locator;
  readonly breakdownTotal: Locator;
  readonly chart: Locator;
  readonly projectionChart: Locator;
  readonly projectionNote: Locator;
  readonly scheduleRows: Locator;
  readonly errorSummary: Locator;
  readonly summaryBar: Locator;

  // Form
  readonly pmiHint: Locator;
  /** The Calculate button the form used to have; results now update as you type. */
  readonly calculateButton: Locator;
  /** The panel holding the form, which scrolls on its own when it is taller than the window. */
  readonly formPanel: Locator;
  /** The takeaway under the home value chart. */
  readonly homeValueNote: Locator;
  /** The headline numbers: the savings (or total interest) and the summary tiles. */
  readonly headline: Locator;

  constructor(private readonly page: Page) {
    this.results = page.getByTestId('results');
    this.totalMonthlyPayment = page.getByTestId('total-monthly-payment');
    this.monthlyPayment = page.getByTestId('monthly-payment');
    this.netSavings = page.getByTestId('net-savings');
    this.totalInterest = page.getByTestId('total-interest');
    this.savingsDetail = page.getByTestId('savings-detail');
    this.timeSaved = page.getByTestId('time-saved');
    this.payoffDate = page.getByTestId('payoff-date');
    this.pmiEnd = page.getByTestId('pmi-end');
    this.recasts = page.getByTestId('recasts');
    this.breakdown = page.getByTestId('payment-breakdown');
    this.breakdownTotal = page.getByTestId('breakdown-total');
    this.chart = page.getByTestId('balance-chart');
    this.projectionChart = page.getByTestId('projection-chart-costs');
    this.projectionNote = page.getByTestId('projection-note-costs');
    this.homeValueNote = page.getByTestId('projection-note-value');
    this.scheduleRows = page.getByTestId('schedule-table').locator('tbody tr');
    this.errorSummary = page.getByTestId('error-summary');
    this.summaryBar = page.getByTestId('summary-bar');
    this.pmiHint = page.getByTestId('pmi-hint');
    this.calculateButton = page.getByTestId('calculate');
    this.formPanel = page.getByTestId('form-panel');
    this.headline = page.getByTestId('headline');
  }

  /** Opens the app and waits for the first (automatic) calculation to render. */
  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.monthlyPayment, 'the default example should calculate on load').toBeVisible();
    await this.calculate();
  }

  /** Any form field, by its test id. */
  field(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** A collapsible form section, e.g. "section-taxes". */
  section(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** The one-line summary shown on a section, e.g. "taxes-summary". */
  sectionSummary(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** Opens every collapsed section, making the form as tall as it gets. */
  async openAllSections(): Promise<void> {
    for (const id of ['section-taxes', 'section-costs', 'section-growth', 'section-options']) {
      await this.openSection(id);
    }
  }

  /** How far the window itself has scrolled, in pixels. */
  windowScrollY(): Promise<number> {
    return this.page.evaluate(() => window.scrollY);
  }

  /** Opens a collapsed section by clicking its header, as a user would. */
  openSection(testId: string): Promise<void> {
    return this.section(testId).locator('summary').click();
  }

  /** Text anywhere on the page, such as a validation message. */
  message(text: string): Locator {
    return this.page.getByText(text);
  }

  /** Types a value into a field, opening its collapsed section first if it is inside one. */
  async set(testId: string, value: number | string): Promise<void> {
    await (await this.reveal(testId)).fill(String(value));
  }

  /** Ticks or unticks a checkbox, opening its section first. */
  async setChecked(testId: string, checked: boolean): Promise<void> {
    await (await this.reveal(testId)).setChecked(checked);
  }

  /** Chooses an option in a select, opening its section first. */
  async choose(testId: string, value: string): Promise<void> {
    await (await this.reveal(testId)).selectOption(value);
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
    for (const id of ['school-tax-rate', 'local-tax-rate', 'mud-tax-rate', 'pid-annual', 'annual-insurance', 'monthly-hoa', 'pmi-rate']) {
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
    await row.getByLabel('Lump sum', { exact: true }).fill(String(amount));
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

  /** Makes every calculation return `problem` as a 400 response. */
  rejectCalculationsWith(problem: object): Promise<void> {
    return this.page.route('**/api/v1/amortization/calculate', (route) =>
      route.fulfill({ status: 400, contentType: 'application/problem+json', body: JSON.stringify(problem) }),
    );
  }

  /** Records whether the page calls the API at all; read the result with the returned function. */
  watchApiCalls(): () => boolean {
    let called = false;
    this.page.on('request', (request) => {
      if (request.url().includes('/api/')) called = true;
    });
    return () => called;
  }

  /** Waits longer than the recalculation pause, so a request that was going to be sent has been. */
  waitPastRecalculationPause(): Promise<void> {
    return this.page.waitForTimeout(1_000);
  }

  /** Opens a result tab: Overview, Projection or Schedule. Each has its own URL. */
  async showResults(tab: 'overview' | 'projection' | 'schedule'): Promise<void> {
    await this.page.getByTestId(`result-tab-${tab}`).click();
    await expect(this.page, `the URL names the ${tab} tab`).toHaveURL(new RegExp(`/calculator/${tab}$`));
  }

  /** Shows the yearly taxes & costs chart (on the Projection tab). */
  showYearlyCosts(): Promise<void> {
    return this.showResults('projection');
  }

  /** Shows market value against taxable value (on the Projection tab). */
  showHomeValueProjection(): Promise<void> {
    return this.showResults('projection');
  }

  /** Switches the table to one row per loan year. */
  async showYearlySchedule(): Promise<void> {
    await this.showResults('schedule');
    await this.page.getByTestId('view-yearly').click();
  }

  /** Switches the table to the standard (no extra payments) schedule. */
  async showStandardSchedule(): Promise<void> {
    await this.showResults('schedule');
    await this.page.getByTestId('view-baseline').click();
  }

  /** Returns the monthly amount shown for a category in the payment breakdown, e.g. "School tax". */
  breakdownAmount(label: string): Locator {
    return this.breakdown.locator('tr', { hasText: label }).locator('td').first();
  }

  /** Returns one schedule cell, found by its column header ("Payment", "Extra", ...), not by position. */
  async cell(paymentNumber: number, column: string): Promise<Locator> {
    if (!this.page.url().endsWith('/schedule')) await this.showResults('schedule');
    const headers = (await this.page.getByTestId('schedule-table').locator('thead th').allTextContents()).map((h) => h.trim());
    const index = headers.indexOf(column);
    expect(index, `the schedule table should have a "${column}" column`).toBeGreaterThanOrEqual(0);
    return this.scheduleRows.nth(paymentNumber - 1).locator('td').nth(index);
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
