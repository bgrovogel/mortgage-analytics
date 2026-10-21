import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ScrubChartComponent, ScrubChartSpec } from '../../../core/charts/scrub-chart.component';
import { PayoffStrategy, STRATEGIES, StrategyProjection } from '../../../core/models/strategy.models';
import { yearLabel, yearTitle } from './net-worth-chart.component';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Debt against wealth for one strategy: what is owed on the mortgage and what the investments are worth
 * (after tax), year by year. Where the lines cross, the investments could pay the mortgage off.
 */
@Component({
  selector: 'app-crossover-chart',
  imports: [ScrubChartComponent, TPipe],
  template: `<app-scrub-chart [title]="'Mortgage owed vs. investments: {0}' | t: [name()]" [spec]="spec()" testId="crossover-chart" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrossoverChartComponent {
  /** Which strategy the projection belongs to. */
  readonly strategy = input.required<PayoffStrategy>();

  /** The strategy in one market scenario. */
  readonly projection = input.required<StrategyProjection>();

  protected readonly name = computed(() => STRATEGIES[this.strategy()].name);

  /** What is drawn: the mortgage owed against the investments after tax. */
  readonly spec = computed<ScrubChartSpec>(() => {
    const years = this.projection().years;
    return {
      labels: years.map((y) => yearLabel(y.year)),
      series: [
        { label: 'Mortgage owed', color: '--series-8', data: years.map((y) => y.mortgageBalance) },
        { label: 'Investments (after tax)', color: STRATEGIES[this.strategy()].color, data: years.map((y) => y.investments) },
      ],
      title: (index) => yearTitle(years[index].year),
      tickEvery: 5,
    };
  });
}
