import { TestBed } from '@angular/core/testing';
import { aStrategyComparison } from '../../../../testing/builders';
import { CrossoverChartComponent } from './crossover-chart.component';
import { NetWorthChartComponent, yearLabel, yearTitle } from './net-worth-chart.component';

describe('strategy charts', () => {
  it('labels years briefly on the axis and fully in the tooltip', () => {
    expect([yearLabel(0), yearLabel(5)]).toEqual(['Now', 'Yr 5']);
    expect([yearTitle(0), yearTitle(5)]).toEqual(['Today', 'Year 5']);
  });

  describe('NetWorthChartComponent', () => {
    const render = (inputs: Record<string, unknown> = {}) => {
      const fixture = TestBed.createComponent(NetWorthChartComponent);
      fixture.componentRef.setInput('result', aStrategyComparison());
      for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
      fixture.detectChanges();
      return { spec: fixture.componentInstance.spec(), host: fixture.nativeElement as HTMLElement };
    };

    it('draws each strategy in its own color, the hybrid dashed, from today to year 30', () => {
      const { spec } = render();

      expect(spec.labels.length).toBe(31);
      expect(spec.series.map((s) => s.label)).toEqual(['Debt free ASAP', 'Invest the difference', 'Hybrid']);
      expect(spec.series.map((s) => !!s.dashed)).toEqual([false, false, true]);
      expect(spec.series[0].data[30]).toBeCloseTo(3_719_026.59, 2);
      expect(spec.title(30, 'Yr 30')).toBe('Year 30');
    });

    it('follows the chosen scenario, in today\'s dollars on request', () => {
      const { spec, host } = render({ scenario: 'expected', todaysDollars: true });

      expect(spec.series[0].data[30]).toBeCloseTo(4_700_702.7 / 2, 2);
      expect(host.querySelector('figcaption')!.textContent).toContain("in today's dollars");
    });

    it('can show each strategy\'s lead over paying off first', () => {
      const { spec, host } = render({ view: 'gap' });

      expect(spec.series[0].data.every((v) => v === 0)).toBe(true);
      expect(host.querySelector('figcaption')!.textContent).toContain('ahead of Debt free ASAP');
    });
  });

  describe('CrossoverChartComponent', () => {
    it('plots what is owed against what is invested, in the strategy\'s color', () => {
      const fixture = TestBed.createComponent(CrossoverChartComponent);
      const outcome = aStrategyComparison().strategies[0];
      fixture.componentRef.setInput('strategy', outcome.strategy);
      fixture.componentRef.setInput('projection', outcome.riskAdjusted);
      fixture.detectChanges();
      const spec = fixture.componentInstance.spec();

      expect(spec.series.map((s) => s.label)).toEqual(['Mortgage owed', 'Investments (after tax)']);
      expect(spec.series[0].data[1]).toBe(280_000);
      // Year 1: net worth 220,634.22 less home equity 130,000.
      expect(spec.series[1].data[1]).toBeCloseTo(90_634.22, 2);
      expect((fixture.nativeElement as HTMLElement).querySelector('figcaption')!.textContent).toContain('Debt free ASAP');
      expect(spec.title(0, 'Now')).toBe('Today');
    });
  });
});
