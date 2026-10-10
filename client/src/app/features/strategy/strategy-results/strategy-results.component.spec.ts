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
  const find = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const text = (root: HTMLElement, id: string) => find(root, id)!.textContent!.replace(/\s+/g, ' ').trim();
  const click = (root: HTMLElement, id: string) => {
    find(root, id)!.click();
    fixture.detectChanges();
  };

  it('leads with the recommended path, and warns when a bad decade would reverse it', () => {
    const root = render();

    expect(text(root, 'recommended')).toBe('Invest the difference');
    expect(text(root, 'downside')).toContain('Debt free ASAP would win by $41,363');
    expect(find(root, 'strategy-verdict')!.classList).toContain('warning');
  });

  it('leads each card with how far it ends behind the leader, then its net worth and payoff', () => {
    const root = render();

    expect(text(root, 'card-InvestTheDifference')).toContain('Recommended');
    expect(text(root, 'card-InvestTheDifference')).toContain('Highest after 30 years');
    expect(text(root, 'card-InvestTheDifference')).toContain('All extra cash invested');
    expect(text(root, 'card-PayOffFirst')).toContain('$125,755 behind Invest');
    expect(text(root, 'card-PayOffFirst')).toContain('All extra cash to the mortgage');
    expect(text(root, 'card-PayOffFirst')).toContain('$3,719,027 net worth · mortgage-free Jun 2041');
    expect(text(root, 'card-Hybrid')).toContain('$18,150 behind Invest');
    expect(text(root, 'card-Hybrid')).toContain('88% invested, 12% to the mortgage');
  });

  it('says when the mortgage outlasts the 30 years', () => {
    const [payOff, invest, hybrid] = aStrategyComparison().strategies;
    const root = render(aStrategyComparison({
      strategies: [payOff, { ...invest, riskAdjusted: { ...invest.riskAdjusted, payoffDate: null, payoffMonth: null } }, hybrid],
    }));

    expect(text(root, 'card-InvestTheDifference')).toContain('mortgage still owed at year 30');
  });

  it('shows one detail at a time, starting with the difference over time', () => {
    const root = render();

    expect(find(root, 'tab-overTime')!.getAttribute('aria-selected')).toBe('true');
    expect(find(root, 'milestones')).toBeNull();
    expect(find(root, 'fact-sheet')).toBeNull();
    expect((find(root, 'view-gap') as HTMLInputElement).checked).toBe(true);

    click(root, 'tab-why');

    expect(find(root, 'tab-why')!.getAttribute('aria-selected')).toBe('true');
    expect(find(root, 'fact-sheet')!.querySelectorAll('li').length).toBe(5);
    expect(find(root, 'view-picker')).toBeNull();
  });

  it('charts the difference from paying off first, and net worth on request', () => {
    const root = render();
    const chart = () => charts.lastConfig();

    expect(chart().data.datasets[0].data.every((v) => v === 0)).toBe(true);
    expect(chart().data.datasets[1].data[30]).toBeCloseTo(3_844_781.09 - 3_719_026.59, 2);

    click(root, 'view-total');

    expect(chart().data.datasets[1].data[30]).toBeCloseTo(3_844_781.09, 2);
  });

  it('switches every card, the table and the charts to another market scenario', () => {
    const root = render();

    click(root, 'scenario-badDecade');
    click(root, 'tab-milestones');

    expect(text(root, 'card-PayOffFirst')).toContain('Highest after 30 years');
    expect(text(root, 'card-PayOffFirst')).toContain('$3,187,296');
    expect(text(root, 'milestones')).toContain('$3,145,932');
  });

  it('tabulates net worth at years 5, 10, 15 and 30, with each value\'s difference from paying off first', () => {
    const root = render();
    click(root, 'tab-milestones');
    const rows = [...root.querySelectorAll('[data-testid="milestones"] tbody tr')];
    const cell = (td: Element) => td.textContent!.replace(/\s+/g, ' ').trim();

    expect(rows.map((r) => r.querySelector('th')!.textContent!.trim())).toEqual(['Year 5', 'Year 10', 'Year 15', 'Year 30']);
    expect(cell(rows[3].querySelector('td.best')!)).toBe('$3,844,781 +$125,755');
    expect(cell(rows[3].querySelector('td')!)).toBe('$3,719,027'); // the baseline has no difference
    expect(text(root, 'closeness')).toContain('All three end within $125,755 (3.3%) of each other.');
  });

  it('can show net worth in today\'s dollars, kept across the chart and the table', () => {
    const root = render();

    click(root, 'todays-dollars');
    click(root, 'tab-milestones');

    expect((find(root, 'todays-dollars') as HTMLInputElement).checked).toBe(true);
    expect(text(root, 'milestones')).toContain('$1,922,391'); // half, in the builder
  });

  it('charts debt against investments for the recommended strategy, and any other on request', () => {
    const root = render();
    click(root, 'tab-crossover');

    expect(text(root, 'crossover-note')).toBe('With Invest the difference, your investments (after tax) pass what you owe on the mortgage in Aug 2033.');

    click(root, 'crossover-PayOffFirst');

    expect(text(root, 'crossover-note')).toContain('Sep 2033');
    expect(charts.lastConfig().data.datasets.map((d) => d.label)).toEqual(['Mortgage owed', 'Investments (after tax)']);
  });
});
