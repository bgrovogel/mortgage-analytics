import { TestBed } from '@angular/core/testing';
import { fakeCharts } from '../../../../testing/fake-charts';
import { RentOrBuyComparison, RentOrBuyYear } from '../../../core/models/amortization.models';
import { RentOrBuyComponent } from './rent-or-buy.component';

describe('RentOrBuyComponent', () => {
  /** Year y with buying ahead by `advantage`: illustrative figures that add up. */
  const year = (y: number, advantage: number): RentOrBuyYear => ({
    year: y, ownershipCost: 40_000 + y * 100, rent: 25_000 + y * 900, homeEquity: 20_000 * y, buyerInvestments: 0,
    buyerNetWorth: 20_000 * y, renterNetWorth: 20_000 * y - advantage, advantage,
  });
  const comparison = (advantages: number[], breakEvenYear: number | null): RentOrBuyComparison => ({
    monthlyRent: 2_100, rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6,
    cashToClose: 48_128.79, breakEvenYear, years: advantages.map((a, i) => year(i + 1, a)),
  });
  /** Thirty years: renting ahead for six, buying from year 7 on. */
  const typical = comparison([...Array(30).keys()].map((i) => (i + 1 - 7) * 5_000 + (i >= 6 ? 1 : 0)), 7);

  let charts: ReturnType<typeof fakeCharts>;
  beforeEach(() => {
    charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider] });
  });

  const render = (c: RentOrBuyComparison) => {
    const fixture = TestBed.createComponent(RentOrBuyComponent);
    fixture.componentRef.setInput('comparison', c);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const rows = () => Array.from(root.querySelectorAll('tbody tr'), (tr) =>
      Array.from(tr.querySelectorAll('th, td'), (c2) => c2.textContent!.replace(/\s+/g, ' ').trim()).join(' | '));
    return { text, rows };
  };

  describe('the three figures', () => {
    it('shows the year buying pulls ahead, and where each side stands after 10 years and at the end', () => {
      const { text } = render(typical);

      expect(text('rent-stat-year')).toBe('Buying pulls aheadYear 7And stays ahead every year after');
      expect(text('rent-stat-ten')).toMatch(/^After 10 yearsBuy by \$[\d,]+\$[\d,]+ bought vs \$[\d,]+ rented$/);
      expect(text('rent-stat-end')).toMatch(/^After 30 yearsBuy by \$[\d,]+\$[\d,]+ bought vs \$[\d,]+ rented$/);
    });

    it('says renting is ahead, when it is, and that buying never pulls ahead', () => {
      const renting = comparison([...Array(30).keys()].map((i) => -(i + 1) * 1_000), null);
      const { text } = render(renting);

      expect(text('rent-stat-year')).toBe('Buying pulls aheadNeverRenting is ahead in all 30 years');
      expect(text('rent-stat-ten')).toContain('Rent by $10,000');
    });

    it('leaves out the ten-year figure when the comparison is shorter than that', () => {
      const short = comparison([-5_000, -2_000, 1_000], 3);

      expect(render(short).text('rent-stat-ten')).toBeUndefined();
    });
  });

  it('says how long to stay for buying to come out ahead', () => {
    expect(render(typical).text('rent-or-buy-verdict')).toBe('Buying comes out ahead if you stay 7 years or more; before that, renting leaves you better off.');
  });

  it('says buying is ahead from the first year when it is', () => {
    expect(render(comparison([1_000, 2_000], 1)).text('rent-or-buy-verdict')).toBe('Buying comes out ahead from the first year.');
  });

  it('says renting stays ahead, and by how much at the end, when buying never catches up', () => {
    expect(render(comparison([-9_000, -12_345.6], null)).text('rent-or-buy-verdict'))
      .toBe('Renting stays ahead for all 2 years: by the end, it leaves you $12,346 better off.');
  });

  it('lays out the milestone years: what each cost that year, where each stands, and the difference', () => {
    expect(render(typical).rows().slice(0, 3)).toEqual([
      'Year 1 | $40,100 | $25,900 | $20,000 | $50,000 | Rent by $30,000',
      'Year 3 | $40,300 | $27,700 | $60,000 | $80,000 | Rent by $20,000',
      'Year 5 | $40,500 | $29,500 | $100,000 | $110,000 | Rent by $10,000',
    ]);
    expect(render(typical).rows().map((r) => r.split(' | ')[0])).toEqual(['Year 1', 'Year 3', 'Year 5', 'Year 7', 'Year 10', 'Year 15', 'Year 20', 'Year 30']);
    expect(render(typical).rows()[3]).toBe('Year 7 | $40,700 | $31,300 | $140,000 | $139,999 | Buy by $1');
  });

  it('plots how far buying is ahead, year by year, crossing zero where it breaks even', () => {
    render(typical);
    const config = charts.config(0);

    expect(config.data.datasets.map((d) => d.label)).toEqual(['Buying ahead by']);
    expect(config.data.datasets[0].data.slice(5, 7)).toEqual([-5_000, 1]);
    expect(config.data.labels).toHaveLength(30);
  });

  it('says what is assumed and what is left out', () => {
    expect(render(typical).text('rent-or-buy-note')).toBe(
      'The renter invests the $48,129 buying would take to close, and each month whichever costs less invests the '
        + 'difference, at 7% a year. Owning includes 1% of the home’s value a year in upkeep, and 6% to sell. Taxes on '
        + 'investment gains, the mortgage interest deduction and extra payments are left out.',
    );
  });
});
