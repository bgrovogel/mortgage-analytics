import { TestBed } from '@angular/core/testing';
import { RentalOutcome, RentalYear } from '../../../core/models/amortization.models';
import { RentalComponent } from './rental.component';

describe('RentalComponent', () => {
  /** Year y of a rental whose rent rises $1,000 a year on a loan costing $24,000: figures that add up. */
  const year = (y: number): RentalYear => {
    const grossRent = 30_000 + (y - 1) * 1_000;
    const netOperatingIncome = grossRent - 8_000;
    return {
      year: y, grossRent, vacancyLoss: 0, managementFee: 0, maintenance: 4_000, operatingCosts: 4_000,
      netOperatingIncome, debtService: 24_000, cashFlow: netOperatingIncome - 24_000,
    };
  };
  const outcome = (overrides: Partial<RentalOutcome> = {}): RentalOutcome => ({
    monthlyRent: 2_500, vacancyPercent: 5, managementPercent: 8, maintenancePercent: 1, rentIncreasePercent: 3,
    cashInvested: 100_000, capRatePercent: 5.5, cashOnCashPercent: -2, debtServiceCoverage: 0.92, grossRentMultiplier: 13.33,
    rentToPricePercent: 0.63, breakEvenMonthlyRent: 2_700, years: [...Array(30).keys()].map((i) => year(i + 1)), ...overrides,
  });

  const render = (rental: RentalOutcome) => {
    const fixture = TestBed.createComponent(RentalComponent);
    fixture.componentRef.setInput('rental', rental);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const rows = () => Array.from(root.querySelectorAll('tbody tr'), (tr) =>
      Array.from(tr.querySelectorAll('th, td'), (c) => c.textContent!.replace(/\s+/g, ' ').trim()).join(' | '));
    const chart = () => (fixture.componentInstance as unknown as { chart: () => { series: { data: number[] }[]; footer?: (i: number) => string } }).chart();
    return { text, rows, chart };
  };

  it('shows the first year: what the owner adds each month, the cap rate and the cash-on-cash return', () => {
    const { text } = render(outcome());

    // Year 1: earns 22,000 against 24,000 of loan, so 2,000 short a year: $167 a month.
    expect(text('rental-stat-cash')).toBe('You add each month$167$2,000 a year, after the loan');
    expect(text('rental-stat-cap')).toContain('Cap rate5.5%');
    expect(text('rental-stat-coc')).toBe('Cash-on-cash-2%The cash flow on the $100,000 you put in');
  });

  it('says the owner keeps money when the rent carries the loan', () => {
    const years = outcome().years.map((y) => ({ ...y, cashFlow: 6_000 }));
    const { text } = render(outcome({ years, cashOnCashPercent: 6 }));

    expect(text('rental-stat-cash')).toBe('You keep each month$500$6,000 a year, after the loan');
  });

  it('says there is no cash-on-cash return when no cash was put in', () => {
    const { text } = render(outcome({ cashInvested: 0, cashOnCashPercent: null }));

    expect(text('rental-stat-coc')).toBe('Cash-on-cashNoneNo cash was put in');
  });

  it('lists the other measures, and says what lenders ask when the rent does not cover the loan enough', () => {
    const { text } = render(outcome());

    expect(text('rental-measures')).toBe(
      'Rent covers the loan0.92 times (lenders ask 1.25)Rent against the price0.63% a monthPrice over a year\'s rent13.33 timesRent that breaks even$2,700 a month');
  });

  it('does not add the lender’s ask when the rent covers the loan well, and has no coverage without a loan', () => {
    expect(render(outcome({ debtServiceCoverage: 1.4 })).text('rental-measures')).toContain('Rent covers the loan1.4 times');
    expect(render(outcome({ debtServiceCoverage: 1.4 })).text('rental-measures')).not.toContain('lenders ask');
    expect(render(outcome({ debtServiceCoverage: null })).text('rental-measures')).toContain('No loan to cover');
  });

  it('says when the rent starts to pay for the home, or that it never does', () => {
    expect(render(outcome()).text('rental-verdict')).toBe('The rent does not pay for the home at first; from year 3 it does.');
    const always = outcome().years.map((y) => ({ ...y, cashFlow: 100 }));
    expect(render(outcome({ years: always })).text('rental-verdict')).toBe('The rent pays for the home from the first year, with something left over.');
    const never = outcome().years.map((y) => ({ ...y, cashFlow: -100 }));
    expect(render(outcome({ years: never })).text('rental-verdict')).toBe('The rent never quite pays for the home in the 30 years: you would add money every year.');
  });

  it('lists the milestone years in a table', () => {
    const { rows } = render(outcome());

    expect(rows().map((r) => r.split(' | ')[0])).toEqual(['Year 1', 'Year 2', 'Year 3', 'Year 5', 'Year 7', 'Year 10', 'Year 15', 'Year 20', 'Year 30']);
    expect(rows()[0]).toBe('Year 1 | $30,000 | $22,000 | $24,000 | -$2,000');
  });

  it('draws the cash flow after the loan, year by year', () => {
    const { chart } = render(outcome());

    expect(chart().series[0].data).toHaveLength(30);
    expect(chart().series[0].data[0]).toBe(-2_000);
    expect(chart().footer?.(0)).toBe('Rent $30,000 · earns $22,000 · loan $24,000');
  });

  it('says what is assumed and what is left out', () => {
    const { text } = render(outcome());

    expect(text('rental-note')).toContain('Rent of $2,500 a month, rising 3% a year, less 5% lost to vacancy.');
    expect(text('rental-note')).toContain('Income tax, depreciation and the home\'s growth in value are left out.');
  });
});
