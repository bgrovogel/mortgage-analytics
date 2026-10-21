import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ScrubChartComponent, ScrubChartSpec } from '../../../core/charts/scrub-chart.component';
import { MarketScenario, STRATEGIES, StrategyComparison, StrategyOutcome } from '../../../core/models/strategy.models';
import { t } from '../../../core/i18n/i18n';

/** Axis labels: "Now", "Yr 1", "Yr 2"... short enough for a phone. */
export const yearLabel = (year: number) => (year === 0 ? t('Now') : t('Yr {0}', [year]));

/** Tooltip titles: "Today", "Year 1"... */
export const yearTitle = (year: number) => (year === 0 ? t('Today') : t('Year {0}', [year]));

/** What the net worth chart plots: each strategy's net worth, or how far each is ahead of paying off first. */
export type NetWorthView = 'total' | 'gap';

/**
 * Net worth over 30 years for each strategy, in one market scenario: home equity plus investments, after
 * the tax still owed on them. The hybrid is dashed, because it often runs along one of the others.
 */
@Component({
  selector: 'app-net-worth-chart',
  imports: [ScrubChartComponent],
  template: `<app-scrub-chart [title]="caption()" [spec]="spec()" testId="net-worth-chart" />`,
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

  protected readonly caption = computed(() => {
    if (this.view() === 'gap') {
      return this.todaysDollars()
        ? t("How far each strategy is ahead of Debt free ASAP, in today's dollars")
        : t('How far each strategy is ahead of Debt free ASAP');
    }
    return this.todaysDollars() ? t("Net worth over 30 years, in today's dollars") : t('Net worth over 30 years');
  });

  /** What is drawn: each strategy's net worth, or its lead over paying off first. */
  readonly spec = computed<ScrubChartSpec>(() => {
    const scenario = this.scenario();
    const real = this.todaysDollars();
    const outcomes = this.result().strategies;
    const years = outcomes[0][scenario].years;
    const worth = (o: StrategyOutcome) => o[scenario].years.map((y) => (real ? y.netWorthInTodaysDollars : y.netWorth));
    const baseline = worth(outcomes.find((o) => o.strategy === 'PayOffFirst')!);
    return {
      labels: years.map((y) => yearLabel(y.year)),
      series: outcomes.map((o) => ({
        label: STRATEGIES[o.strategy].name,
        color: STRATEGIES[o.strategy].color,
        data: this.view() === 'gap' ? worth(o).map((value, i) => value - baseline[i]) : worth(o),
        dashed: o.strategy === 'Hybrid',
      })),
      title: (index) => yearTitle(years[index].year),
      tickEvery: 5,
    };
  });
}
