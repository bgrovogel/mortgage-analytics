import { TestBed } from '@angular/core/testing';
import { aStrategyComparison } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { CrossoverChartComponent } from './crossover-chart.component';
import { NetWorthChartComponent, yearLabel, yearTitle } from './net-worth-chart.component';

describe('strategy charts', () => {
  const setup = () => {
    const charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider] });
    return charts;
  };

  it('labels years briefly on the axis and fully in the tooltip', () => {
    expect([yearLabel(0), yearLabel(5)]).toEqual(['Now', 'Yr 5']);
    expect([yearTitle(0), yearTitle(5)]).toEqual(['Today', 'Year 5']);
  });

  describe('NetWorthChartComponent', () => {
    const render = (inputs: Record<string, unknown> = {}) => {
      const charts = setup();
      const fixture = TestBed.createComponent(NetWorthChartComponent);
      fixture.componentRef.setInput('result', aStrategyComparison());
      for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
      fixture.detectChanges();
      return { config: charts.lastConfig(), host: fixture.nativeElement as HTMLElement };
    };

    it('draws each strategy in its own color, the hybrid dashed, from today to year 30', () => {
      const { config } = render();

      expect(config.data.labels!.length).toBe(31);
      expect(config.data.datasets.map((d) => d.label)).toEqual(['Debt free ASAP', 'Invest the difference', 'Hybrid']);
      expect(config.data.datasets.map((d) => d.borderDash)).toEqual([[], [], [6, 4]]);
      expect(config.data.datasets[0].data[30]).toBeCloseTo(3_719_026.59, 2);
      expect(config.options!.plugins!.tooltip!.callbacks!.title!.call({} as never, [{ dataIndex: 30 }] as never)).toBe('Year 30');
    });

    it('follows the chosen scenario, in today\'s dollars on request', () => {
      const { config, host } = render({ scenario: 'expected', todaysDollars: true });

      expect(config.data.datasets[0].data[30]).toBeCloseTo(4_700_702.7 / 2, 2);
      expect(host.querySelector('figcaption')!.textContent).toContain("in today's dollars");
    });

    it('can show each strategy\'s lead over paying off first', () => {
      const { config, host } = render({ view: 'gap' });

      expect(config.data.datasets[0].data.every((v) => v === 0)).toBe(true);
      expect(host.querySelector('figcaption')!.textContent).toContain('ahead of Debt free ASAP');
    });
  });

  describe('CrossoverChartComponent', () => {
    it('plots what is owed against what is invested, in the strategy\'s color', () => {
      const charts = setup();
      const fixture = TestBed.createComponent(CrossoverChartComponent);
      const outcome = aStrategyComparison().strategies[0];
      fixture.componentRef.setInput('strategy', outcome.strategy);
      fixture.componentRef.setInput('projection', outcome.riskAdjusted);
      fixture.detectChanges();
      const config = charts.lastConfig();

      expect(config.data.datasets.map((d) => d.label)).toEqual(['Mortgage owed', 'Investments (after tax)']);
      expect(config.data.datasets[0].data[1]).toBe(280_000);
      expect(config.data.datasets[1].data[1]).toBe(30_000);
      expect((fixture.nativeElement as HTMLElement).querySelector('figcaption')!.textContent).toContain('Debt free ASAP');
      expect(config.options!.plugins!.tooltip!.callbacks!.title!.call({} as never, [{ dataIndex: 0 }] as never)).toBe('Today');
    });
  });
});
