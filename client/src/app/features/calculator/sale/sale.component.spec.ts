import { TestBed } from '@angular/core/testing';
import { SaleOutcome, SaleScenario, SaleYear } from '../../../core/models/amortization.models';
import { SaleComponent } from './sale.component';

describe('SaleComponent', () => {
  /** Year y of a $300,000 home: figures that add up, a $20,000 rise a year and $4,000 more of the loan paid off. */
  const year = (y: number, overrides: Partial<SaleYear> = {}): SaleYear => {
    const homeValue = 300_000 + y * 20_000;
    const loanBalance = 280_000 - y * 4_000;
    const sellingCosts = homeValue * 0.06;
    const gain = homeValue - sellingCosts - 300_000;
    const taxOnGain = y < 2 ? Math.max(gain, 0) * 0.15 : 0;
    return {
      year: y, homeValue, loanBalance, sellingCosts, gain, taxFreeGain: y < 2 ? 0 : Math.max(gain, 0), taxOnGain,
      netProceeds: homeValue - loanBalance - sellingCosts - taxOnGain, ...overrides,
    };
  };
  const years = (overrides: (y: number) => Partial<SaleYear> = () => ({})) => [...Array(30).keys()].map((i) => year(i + 1, overrides(i + 1)));
  const outcome = (overrides: Partial<SaleOutcome> = {}): SaleOutcome => ({
    sellingCostPercent: 6, gainsTaxRatePercent: 15, exclusionPerSale: 250_000, years: years(), scenarios: [], ...overrides,
  });
  /** The same sale if the home's value moved by `change` a year: its own figures in the years named, the rest as the plan's. */
  const scenario = (change: number, figures: Record<number, Partial<SaleYear>>): SaleScenario => ({
    yearlyChangePercent: change, years: years((y) => figures[y] ?? {}),
  });

  const render = (sale: SaleOutcome) => {
    const fixture = TestBed.createComponent(SaleComponent);
    fixture.componentRef.setInput('sale', sale);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const rows = () => Array.from(root.querySelectorAll('tbody tr'), (tr) =>
      Array.from(tr.querySelectorAll('th, td'), (c) => c.textContent!.replace(/\s+/g, ' ').trim()).join(' | '));
    const pick = (value: string) => {
      const select = root.querySelector('[data-testid="sale-year"]') as HTMLSelectElement;
      select.value = value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const chart = () => (fixture.componentInstance as unknown as { chart: () => { series: { data: number[] }[]; footer?: (i: number) => string } }).chart();
    return { text, rows, pick, chart };
  };

  describe('if prices differ', () => {
    const withScenarios = () => outcome({
      scenarios: [
        scenario(-3, { 5: { homeValue: 250_000, netProceeds: -20_523.72 }, 10: { homeValue: 220_000, netProceeds: -9_000 } }),
        scenario(0, { 5: { homeValue: 300_000, netProceeds: 20_000 }, 10: { homeValue: 300_000, netProceeds: 45_000 } }),
        scenario(5, { 5: { homeValue: 330_000, netProceeds: 49_000 }, 10: { homeValue: 400_000, netProceeds: 130_000 } }),
      ],
    });
    const scenarioRows = (root: HTMLElement) => Array.from(root.querySelectorAll('[data-testid="sale-scenarios"] tbody tr'), (tr) =>
      Array.from(tr.querySelectorAll('th, td'), (c) => c.textContent!.replace(/\s+/g, ' ').trim()).join(' | '));

    it('is left out when no value scenarios were asked for', () => {
      const { text } = render(outcome());

      expect(text('sale-scenarios')).toBeUndefined();
    });

    it('sets the chosen year under each yearly change, then as the plan has it', () => {
      const fixture = TestBed.createComponent(SaleComponent);
      fixture.componentRef.setInput('sale', withScenarios());
      fixture.detectChanges();

      expect(scenarioRows(fixture.nativeElement)).toEqual([
        'Prices fall 3% a year | $250,000 | -$20,524',
        'Prices stay flat | $300,000 | $20,000',
        'Prices rise 5% a year | $330,000 | $49,000',
        'As planned | $400,000 | $116,000',
      ]);
    });

    it('follows the year chosen', () => {
      const fixture = TestBed.createComponent(SaleComponent);
      fixture.componentRef.setInput('sale', withScenarios());
      fixture.detectChanges();
      const select = fixture.nativeElement.querySelector('[data-testid="sale-year"]') as HTMLSelectElement;
      select.value = '10';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(scenarioRows(fixture.nativeElement)).toEqual([
        'Prices fall 3% a year | $220,000 | -$9,000',
        'Prices stay flat | $300,000 | $45,000',
        'Prices rise 5% a year | $400,000 | $130,000',
        'As planned | $500,000 | $230,000',
      ]);
    });

    it('says what it is for, in a heading the table is named by', () => {
      const { text } = render(withScenarios());

      expect(text('sale-scenarios-heading')).toBe('If prices differ');
    });
  });

  it('starts on five years, and shows what a sale then would leave', () => {
    const { text } = render(outcome());

    // Year 5: sells for $400,000, owes $260,000, costs $24,000, a $76,000 gain all under the exclusion.
    expect(text('sale-stat-net')).toBe('You walk away with$116,000After the loan, the costs and the tax');
    expect(text('sale-stat-gain')).toContain('$76,000');
    expect(text('sale-stat-tax')).toBe('Tax on the gain$0All of it is tax-free (up to $250,000)');
  });

  it('breaks the sale down from the price to what is kept', () => {
    const { text } = render(outcome());

    expect(text('sale-breakdown')).toBe(
      'The home sells for$400,000The loan you pay off− $260,000Selling costs (6%)− $24,000Tax on the gain$0You walk away with$116,000');
  });

  it('shows another year when it is chosen', () => {
    const { text, pick } = render(outcome());

    pick('10');

    // Year 10: sells for $500,000, owes $240,000, costs $30,000.
    expect(text('sale-breakdown')).toContain('The home sells for$500,000');
    expect(text('sale-stat-net')).toContain('$230,000');
  });

  it('starts on the last year of a loan shorter than five', () => {
    const { text } = render(outcome({ years: [year(1), year(2), year(3)] }));

    expect(text('sale-breakdown')).toContain('The home sells for$360,000');
  });

  it('says the first year has no tax-free gain, because two years in the home are needed', () => {
    const { text, pick } = render(outcome());

    pick('1');

    expect(text('sale-stat-tax')).toContain('Tax-free only after two years in the home');
  });

  it('says a home that is not lived in has no tax-free gain', () => {
    const { text } = render(outcome({ exclusionPerSale: 0, years: years(() => ({ taxFreeGain: 0, taxOnGain: 1_000 })) }));

    expect(text('sale-stat-tax')).toContain('A home you do not live in has no tax-free gain');
    expect(text('sale-note')).toContain('A home you do not live in has no tax-free gain, so all of it is taxed at 15%');
  });

  it('says part of the gain is tax-free when the exclusion does not cover it', () => {
    const { text } = render(outcome({ years: years((y) => (y === 5 ? { gain: 300_000, taxFreeGain: 250_000, taxOnGain: 7_500 } : {})) }));

    expect(text('sale-stat-tax')).toBe('Tax on the gain$7,500$250,000 of it is tax-free');
  });

  it('says a sale that does not cover the loan needs money brought to closing', () => {
    const { text } = render(outcome({ years: years((y) => (y === 5 ? { netProceeds: -12_000, gain: -20_000, taxFreeGain: 0, taxOnGain: 0 } : {})) }));

    expect(text('sale-stat-net')).toBe('You would need to bring$12,000The sale does not cover the loan and the costs');
    expect(text('sale-stat-gain')).toContain('The loss$20,000');
    expect(text('sale-stat-tax')).toContain('A loss is not taxed');
    expect(text('sale-breakdown')).toContain('You bring to closing$12,000');
  });

  it('lists the milestone years in a table', () => {
    const { rows } = render(outcome());

    expect(rows().map((r) => r.split(' | ')[0])).toEqual(['Year 1', 'Year 2', 'Year 3', 'Year 5', 'Year 7', 'Year 10', 'Year 15', 'Year 20', 'Year 30']);
    expect(rows()[3]).toBe('Year 5 | $400,000 | $260,000 | $24,000 | $0 | $116,000');
  });

  it('draws what a sale would leave, year by year', () => {
    const { chart } = render(outcome());

    expect(chart().series[0].data).toHaveLength(30);
    expect(chart().series[0].data[4]).toBe(116_000);
    expect(chart().footer?.(4)).toBe('Sells for $400,000 · owe $260,000 · costs $24,000 · tax $0');
  });

  it('says what is assumed and what is left out', () => {
    const { text } = render(outcome({ sellingCostPercent: 6, gainsTaxRatePercent: 20 }));

    expect(text('sale-note')).toContain('shelters the first $250,000 of gain from tax once you have owned it two years. Any gain over that is taxed at 20%.');
    expect(text('sale-note')).toContain('State tax, and a loss against other income, are left out.');
  });
});
