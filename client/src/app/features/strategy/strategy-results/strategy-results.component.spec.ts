import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aStrategyComparison } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { StrategyComparison } from '../../../core/models/strategy.models';
import { StrategyResultsComponent } from './strategy-results.component';

describe('StrategyResultsComponent', () => {
  let fixture: ComponentFixture<StrategyResultsComponent>;
  let charts: ReturnType<typeof fakeCharts>;

  const render = (result: StrategyComparison = aStrategyComparison()) => {
    charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider] });
    fixture = TestBed.createComponent(StrategyResultsComponent);
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const text = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`)!.textContent!.replace(/\s+/g, ' ').trim();
  const click = (root: HTMLElement, id: string) => {
    (root.querySelector(`[data-testid="${id}"]`) as HTMLInputElement).click();
    fixture.detectChanges();
  };

  it('leads with the recommended path, and warns when a bad decade would reverse it', () => {
    const root = render();

    expect(text(root, 'recommended')).toBe('Invest the difference');
    expect(text(root, 'downside')).toContain('Debt free ASAP comes out ahead by $41,363');
    expect(root.querySelector('[data-testid="strategy-verdict"]')!.classList).toContain('warning');
  });

  it('shows a card per strategy, marking the recommended one', () => {
    const root = render();

    expect(text(root, 'card-PayOffFirst')).toContain('$3,719,027');
    expect(text(root, 'card-PayOffFirst')).toContain('All extra cash to the mortgage');
    expect(text(root, 'card-PayOffFirst')).toContain('Mortgage-free Jun 2041');
    expect(text(root, 'card-InvestTheDifference')).toContain('Recommended');
    expect(text(root, 'card-InvestTheDifference')).toContain('All extra cash invested');
    expect(text(root, 'card-Hybrid')).toContain('58% invested, 42% to the mortgage');
  });

  it('says when the mortgage outlasts the 30 years', () => {
    const base = aStrategyComparison();
    const [payOff, invest, hybrid] = base.strategies;
    const root = render(aStrategyComparison({
      strategies: [payOff, { ...invest, riskAdjusted: { ...invest.riskAdjusted, payoffDate: null, payoffMonth: null } }, hybrid],
    }));

    expect(text(root, 'card-InvestTheDifference')).toContain('Mortgage still owed after 30 years');
  });

  it('switches every card, the table and the charts to another market scenario', () => {
    const root = render();

    click(root, 'scenario-badDecade');

    expect(text(root, 'card-PayOffFirst')).toContain('$3,187,296');
    const datasets = charts.lastConfig().data.datasets;
    expect(datasets.length).toBe(2); // the crossover chart redraws last
    expect(text(root, 'milestones')).toContain('$3,187,296');
  });

  it('tabulates net worth at years 5, 10, 15 and 30, marking the best of each', () => {
    const root = render();
    const rows = [...root.querySelectorAll('[data-testid="milestones"] tbody tr')];

    expect(rows.map((r) => r.querySelector('th')!.textContent!.trim())).toEqual(['Year 5', 'Year 10', 'Year 15', 'Year 30']);
    expect(rows[3].querySelector('td.best')!.textContent).toBe('$3,844,781');
  });

  it('can show net worth in today\'s dollars', () => {
    const root = render();

    click(root, 'todays-dollars');

    expect(text(root, 'milestones')).toContain('$1,922,391'); // half, in the builder
    expect(root.textContent).toContain("Shown in today's dollars.");
  });

  it('can chart the gap to paying off first, where small differences show', () => {
    const root = render();

    click(root, 'view-gap');

    const netWorth = charts.lastConfig();
    expect(netWorth.data.datasets[0].data.every((v) => v === 0)).toBe(true);
    expect(netWorth.data.datasets[1].data[30]).toBeCloseTo(3_844_781.09 - 3_719_026.59, 2);
  });

  it('charts debt against wealth for the recommended strategy, and any other on request', () => {
    const root = render();

    expect(text(root, 'crossover-note')).toBe('With Invest the difference, your investments (after tax) pass what you owe on the mortgage in Aug 2033.');

    click(root, 'crossover-PayOffFirst');

    expect(text(root, 'crossover-note')).toContain('Sep 2033');
    expect(charts.lastConfig().data.datasets.map((d) => d.label)).toEqual(['Mortgage owed', 'Investments (after tax)']);
  });

  it('explains why, in a fact sheet', () => {
    const root = render();

    expect(root.querySelector('[data-testid="fact-sheet"] h3')!.textContent).toBe('Why Invest the difference');
    expect(root.querySelectorAll('[data-testid="fact-sheet"] li').length).toBe(6);
  });
});
