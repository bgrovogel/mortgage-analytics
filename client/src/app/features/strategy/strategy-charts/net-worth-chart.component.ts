import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { hostChart } from '../../../core/charts/chart-host';
import { LineSeries, buildLineChart } from '../../../core/charts/line-chart';
import { MarketScenario, STRATEGIES, StrategyComparison, StrategyOutcome } from '../../../core/models/strategy.models';

/** Axis labels: "Now", "Yr 1", "Yr 2"... short enough for a phone. */
export const yearLabel = (year: number) => (year === 0 ? 'Now' : `Yr ${year}`);

/** Tooltip titles: "Today", "Year 1"... */
export const yearTitle = (year: number) => (year === 0 ? 'Today' : `Year ${year}`);

/** What the net worth chart plots: each strategy's net worth, or how far each is ahead of paying off first. */
export type NetWorthView = 'total' | 'gap';

/**
 * Net worth over 30 years for each strategy, in one market scenario: home equity plus investments, after
 * the tax still owed on them. The hybrid is dashed, because it often runs along one of the others.
 */
@Component({
  selector: 'app-net-worth-chart',
  template: `
    <figure>
      <figcaption id="net-worth-title">
        {{ view() === 'gap' ? 'How far each strategy is ahead of Debt free ASAP' : 'Net worth over 30 years' }}{{ todaysDollars() ? ", in today's dollars" : '' }}
      </figcaption>
      <div class="canvas-wrap">
        <canvas #canvas role="img" aria-labelledby="net-worth-title" data-testid="net-worth-chart"></canvas>
      </div>
    </figure>
  `,
  styles: `
    figure { margin: 0; }
    figcaption { font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary); }
    .canvas-wrap { position: relative; height: 320px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthChartComponent {
  /** The comparison to plot. */
  readonly result = input.required<StrategyComparison>();

  /** Which market path to show. */
  readonly scenario = input<MarketScenario>('riskAdjusted');

  /** True to shrink every year by inflation. */
  readonly todaysDollars = input(false);

  /**
   * Net worth itself, or each strategy minus paying off first. Over 30 years the totals dwarf the differences
   * between strategies, so the gap view is where those differences can actually be seen.
   */
  readonly view = input<NetWorthView>('total');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    hostChart(
      () => this.canvas().nativeElement,
      (host) => {
        const scenario = this.scenario();
        const real = this.todaysDollars();
        const outcomes = this.result().strategies;
        const years = outcomes[0][scenario].years;
        const worth = (o: StrategyOutcome) => o[scenario].years.map((y) => (real ? y.netWorthInTodaysDollars : y.netWorth));
        const baseline = worth(outcomes.find((o) => o.strategy === 'PayOffFirst')!);
        const series: LineSeries[] = outcomes.map((o) => ({
          label: STRATEGIES[o.strategy].name,
          color: STRATEGIES[o.strategy].color,
          data: this.view() === 'gap' ? worth(o).map((value, i) => value - baseline[i]) : worth(o),
          dashed: o.strategy === 'Hybrid',
        }));
        return buildLineChart(
          {
            labels: years.map((y) => yearLabel(y.year)),
            series,
            title: (index) => yearTitle(years[index].year),
            tickEvery: 5,
          },
          host,
        );
      },
    );
  }
}
