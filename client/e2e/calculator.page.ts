import { Locator, Page, expect } from '@playwright/test';

/** The inputs a test can set. Anything left out keeps the form's default. */
export interface LoanInput {
  homePrice: number;
  downPayment: number;
  rate: number;
  years: number;
  firstPayment?: string;
}

/** Page object: tests describe intent ("fill the loan"), and selectors live here, in one place. */
export class CalculatorPage {
  readonly homePrice: Locator;
  readonly downPayment: Locator;
  readonly interestRate: Locator;
  readonly termYears: Locator;
  readonly firstPaymentDate: Locator;
  readonly monthlyExtra: Locator;
  readonly annualExtra: Locator;
  readonly calculateButton: Locator;
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

  constructor(private readonly page: Page) {
    this.homePrice = page.getByTestId('home-price');
    this.downPayment = page.getByTestId('down-payment');
    this.interestRate = page.getByTestId('interest-rate');
    this.termYears = page.getByTestId('term-years');
    this.firstPaymentDate = page.getByTestId('first-payment-date');
    this.monthlyExtra = page.getByTestId('monthly-extra');
    this.annualExtra = page.getByTestId('annual-extra');
    this.calculateButton = page.getByTestId('calculate');
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
  }

  /** Opens the app and waits for the first (automatic) calculation to render. */
  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.monthlyPayment).toBeVisible();
  }

  /** Fills the purchase and loan fields. */
  async fillLoan(loan: LoanInput): Promise<void> {
    await this.homePrice.fill(String(loan.homePrice));
    await this.downPayment.fill(String(loan.downPayment));
    await this.interestRate.fill(String(loan.rate));
    await this.termYears.fill(String(loan.years));
    if (loan.firstPayment) {
      await this.firstPaymentDate.fill(loan.firstPayment);
    }
  }

  /** Zeroes every tax, insurance and fee field, leaving principal and interest only. */
  async clearHousingCosts(): Promise<void> {
    for (const id of ['school-tax-rate', 'property-tax-rate', 'mud-tax-rate', 'pid-annual', 'annual-insurance', 'monthly-hoa', 'pmi-rate']) {
      await this.page.getByTestId(id).fill('0');
    }
  }

  /** Sets the extra-payment fields; lump sums are added separately. */
  async setExtras(monthly: number, annual = 0): Promise<void> {
    await this.monthlyExtra.fill(String(monthly));
    await this.annualExtra.fill(String(annual));
  }

  /** Adds a lump-sum row and fills it. */
  async addLumpSum(amount: number, paymentNumber: number): Promise<void> {
    await this.page.getByTestId('add-lump-sum').click();
    const row = this.page.getByTestId('lump-sum').last();
    await row.getByLabel('Lump sum ($)').fill(String(amount));
    await row.getByLabel('With payment #').fill(String(paymentNumber));
  }

  /** Chooses the recast strategy and sets the lender's terms. */
  async chooseRecast(minimumLumpSum = 10_000, fee = 250): Promise<void> {
    await this.page.getByTestId('strategy-recast').check();
    await this.page.getByTestId('recast-minimum').fill(String(minimumLumpSum));
    await this.page.getByTestId('recast-fee').fill(String(fee));
  }

  /** Clicks Calculate and waits for the API response. */
  async calculate(): Promise<void> {
    const response = this.page.waitForResponse('**/api/v1/amortization/calculate');
    await this.calculateButton.click();
    await response;
  }

  /** Sets a form field by its test id. */
  async set(testId: string, value: number): Promise<void> {
    await this.page.getByTestId(testId).fill(String(value));
  }

  /** Returns the monthly amount shown for a category in the payment breakdown, e.g. "School tax". */
  breakdownAmount(label: string): Locator {
    return this.breakdown.locator('tr', { hasText: label }).locator('td').first();
  }

  /** Switches the table to the standard (no extra payments) schedule. */
  showStandardSchedule(): Promise<void> {
    return this.page.getByTestId('view-baseline').click();
  }

  /** Returns the text of one cell in the schedule table. */
  cell(paymentNumber: number, column: number): Locator {
    return this.scheduleRows.nth(paymentNumber - 1).locator('td').nth(column);
  }
}
