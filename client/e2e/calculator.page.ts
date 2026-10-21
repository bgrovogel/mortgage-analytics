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
/** Fields of the separate (Texas) taxes, shown once the form is switched to them. */
const SEPARATE_TAX_FIELDS = ['school-tax-rate', 'local-tax-rate', 'mud-tax-rate', 'school-exemption', 'local-exemption', 'mud-exemption', 'is-over-65'];

export class CalculatorPage {
  // Results
  readonly results: Locator;
  readonly totalMonthlyPayment: Locator;
  readonly monthlyPayment: Locator;
  readonly netSavings: Locator;
  readonly totalInterest: Locator;
  readonly savingsDetail: Locator;
  readonly timeSaved: Locator;
  readonly samePayoff: Locator;
  readonly staleResults: Locator;
  readonly payoffDate: Locator;
  readonly pmiEnd: Locator;
  /** What the other way of removing PMI would do: asking at 80%, or leaving it to automatic removal at 78%. */
  readonly pmiOtherChoice: Locator;
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
    this.totalMonthlyPayment = page.getByTestId('lead-amount');
    this.monthlyPayment = page.getByTestId('monthly-payment');
    this.netSavings = page.getByTestId('net-savings');
    this.totalInterest = page.getByTestId('total-interest');
    this.savingsDetail = page.getByTestId('savings-detail');
    this.timeSaved = page.getByTestId('time-saved');
    this.samePayoff = page.getByTestId('same-payoff');
    this.staleResults = page.getByTestId('stale-results');
    this.payoffDate = page.getByTestId('payoff-date');
    this.pmiEnd = page.getByTestId('pmi-end');
    this.pmiOtherChoice = page.getByTestId('pmi-other-choice');
    this.recasts = page.getByTestId('recasts');
    this.breakdown = page.getByTestId('payment-breakdown');
    this.breakdownTotal = page.getByTestId('breakdown-total');
    this.chart = page.getByTestId('balance-chart');
    this.projectionChart = page.getByTestId('projection-chart-costs');
    this.projectionNote = page.getByTestId('projection-note-costs');
    this.homeValueNote = page.getByTestId('projection-note-value');
    this.scheduleRows = page.getByTestId('schedule-table').locator('tbody tr');
    this.errorSummary = page.getByTestId('calculation-errors');
    this.summaryBar = page.getByTestId('summary-bar');
    this.pmiHint = page.getByTestId('pmi-hint');
    this.calculateButton = page.getByTestId('calculate');
    this.formPanel = page.getByTestId('form-panel');
    this.headline = page.getByTestId('headline');
  }

  /** Opens the app and waits for the first (automatic) calculation to render. */
  async open(): Promise<void> {
    await this.page.goto('/calculator');
    await expect(this.monthlyPayment, 'the default example should calculate on load').toBeVisible();
    await this.calculate();
  }

  /** Any form field, by its test id. */
  field(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** A collapsible form section, e.g. "section-costs". */
  section(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** The one-line summary shown on a section, e.g. "taxes-summary". */
  sectionSummary(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  /** Opens every collapsed section, making the form as tall as it gets. */
  async openAllSections(): Promise<void> {
    for (const id of ['section-loan', 'section-costs', 'section-closing', 'section-income', 'section-options', 'section-growth']) {
      await this.openSection(id);
    }
  }

  /** Opens a collapsed section by clicking its header, as a user would. */
  openSection(testId: string): Promise<void> {
    return this.section(testId).locator('summary').click();
  }

  /** Text anywhere on the page, such as a validation message. */
  message(text: string): Locator {
    return this.page.getByText(text);
  }

  /**
   * Types a value into a field, opening its collapsed section first if it is inside one. A field of the separate
   * (Texas) taxes switches the form to them first, as a person would.
   */
  async set(testId: string, value: number | string): Promise<void> {
    if (SEPARATE_TAX_FIELDS.includes(testId)) await this.chooseTaxMode('separate');
    await (await this.reveal(testId)).fill(String(value));
  }

  /** Chooses one property tax rate, or the separate school, county/city and MUD taxes. */
  async chooseTaxMode(mode: 'single' | 'separate'): Promise<void> {
    await (await this.reveal(`tax-mode-${mode}`)).check();
  }

  /** Chooses how the rate works (fixed, a buydown, or adjustable), opening its section first. */
  async chooseRateType(type: 'fixed' | 'buydown' | 'arm'): Promise<void> {
    await (await this.reveal(`rate-type-${type}`)).check();
  }

  /** Ticks or unticks a checkbox, opening its section first (switching to the separate taxes for over-65 relief). */
  async setChecked(testId: string, checked: boolean): Promise<void> {
    if (SEPARATE_TAX_FIELDS.includes(testId)) await this.chooseTaxMode('separate');
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
    // Both ways of entering taxes: the separate rates (ready for a test that sets one), then the single rate, in use.
    for (const id of ['school-tax-rate', 'local-tax-rate', 'mud-tax-rate']) await this.set(id, 0);
    await this.chooseTaxMode('single');
    for (const id of ['property-tax-rate', 'pid-annual', 'annual-insurance', 'monthly-hoa', 'pmi-rate']) {
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
  async failNextCalculation(): Promise<void> {
    await this.page.route('**/api/v1/amortization/calculate', (route) => route.abort(), { times: 1 });
  }

  /** Makes every calculation return `problem` as a 400 response. */
  async rejectCalculationsWith(problem: object): Promise<void> {
    await this.page.route('**/api/v1/amortization/calculate', (route) =>
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

  /** On the Compare tab, switches the form to one of the homes. */
  async editHome(house: 'A' | 'B' | 'C' | 'D'): Promise<void> {
    await this.page.getByTestId(`edit-home-${house.toLowerCase()}`).check();
    await expect(this.page.getByTestId('loan-heading'), `the form now edits Home ${house}`).toHaveText(`Home ${house}`);
  }

  /** On the Compare tab, adds a home (a copy of Home A) and edits it. */
  async addHome(house: 'C' | 'D'): Promise<void> {
    await this.page.getByTestId('add-home').click();
    await expect(this.page.getByTestId('loan-heading'), `the form now edits the new Home ${house}`).toHaveText(`Home ${house}`);
  }

  /** Saves the current calculation under `name`, as a new saved calculation, with a note and tags (typed separated by commas) when given. */
  async saveAs(name: string, note?: string, tags?: string): Promise<void> {
    await this.page.getByTestId('save-open').click();
    await this.page.getByTestId('save-name').fill(name);
    if (note) await this.page.getByTestId('save-note').fill(note);
    if (tags) await this.page.getByTestId('save-tags').fill(tags);
    await this.page.getByTestId('save-new').click();
    await expect(this.page.getByTestId('save-status'), 'the save is confirmed').toContainText(`Saved as “${name}”`);
  }

  /** Opens a result tab: Overview, Affordability, Closing, Rent or buy, Projection, If you sell, As a rental or Schedule. Each has its own URL. */
  async showResults(tab: 'overview' | 'affordability' | 'closing' | 'rent-or-buy' | 'projection' | 'sale' | 'rental' | 'schedule'): Promise<void> {
    // The views under Cost are one step down: from another question, go through Cost first.
    const link = this.page.getByTestId(`result-tab-${tab}`);
    if (!(await link.isVisible())) await this.page.getByTestId('result-tab-overview').click();
    await link.click();
    await expect(this.page, `the URL names the ${tab} tab`).toHaveURL(new RegExp(`/calculator/${tab}$`));
  }

  /** Goes to Compare homes from the page links, where Home A is the calculator's loan. */
  async compareHomes(): Promise<void> {
    await this.page.getByTestId('result-tab-compare').click();
    await expect(this.page, 'the Compare homes page').toHaveURL(/\/compare$/);
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
    // allTextContents does not wait, so first wait for the column to be rendered (the tab may have just opened).
    const headerCells = this.page.getByTestId('schedule-table').locator('thead th');
    await expect(headerCells.filter({ hasText: column }).first(), `the "${column}" column is rendered`).toBeVisible();
    const headers = (await headerCells.allTextContents()).map((h) => h.trim());
    const index = headers.indexOf(column);
    expect(index, `the schedule table should have a "${column}" column`).toBeGreaterThanOrEqual(0);
    // The monthly rows come a loan year at a time: open the year the payment is in, and count from its first row.
    const pager = this.page.getByTestId('page-year');
    if (await pager.count() === 0) return this.scheduleRows.nth(paymentNumber - 1).locator('td').nth(index);
    const year = String(Math.ceil(paymentNumber / 12));
    if ((await pager.inputValue()) !== year) await pager.selectOption(year);
    return this.scheduleRows.nth((paymentNumber - 1) % 12).locator('td').nth(index);
  }

  /** Shows every payment of the schedule at once, instead of a loan year of them. */
  async showAllPayments(): Promise<void> {
    await this.showResults('schedule');
    await this.page.getByTestId('page-year').selectOption('all');
  }

  /** Returns the element, first opening the collapsed section that contains it (if any). */
  private async reveal(testId: string): Promise<Locator> {
    // On a phone the form is a sheet that opens from the results: open it first, as a user would.
    const edit = this.page.getByTestId('edit-inputs');
    if ((await edit.isVisible()) && !(await this.formPanel.isVisible())) await edit.click();
    const element = this.page.getByTestId(testId);
    const section = element.locator('xpath=ancestor::details');
    if ((await section.count()) > 0 && !(await section.evaluate((d: HTMLDetailsElement) => d.open))) {
      await section.locator('summary').click();
    }
    return element;
  }
}
