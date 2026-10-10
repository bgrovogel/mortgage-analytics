import { ChangeDetectionStrategy, Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { hostChart } from '../../../core/charts/chart-host';
import { buildLineChart } from '../../../core/charts/line-chart';
import { PayoffStrategy, STRATEGIES, StrategyProjection } from '../../../core/models/strategy.models';
import { yearLabel, yearTitle } from './net-worth-chart.component';

/**
 * Debt against wealth for one strategy: what is owed on the mortgage and what the investments are worth
 * (after tax), year by year. Where the lines cross, the investments could pay the mortgage off.
 */
@Component({
  selector: 'app-crossover-chart',
  template: `
    <figure>
      <figcaption id="crossover-title">Mortgage owed vs. investments: {{ name() }}</figcaption>
      <div class="canvas-wrap">
        <canvas #canvas role="img" aria-labelledby="crossover-title" data-testid="crossover-chart"></canvas>
      </div>
    </figure>
  `,
  styles: `
    figure { margin: 0; }
    figcaption { font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary); }
    .canvas-wrap { position: relative; height: 280px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrossoverChartComponent {
  /** Which strategy the projection belongs to. */
  readonly strategy = input.required<PayoffStrategy>();

  /** The strategy in one market scenario. */
  readonly projection = input.required<StrategyProjection>();

  protected readonly name = computed(() => STRATEGIES[this.strategy()].name);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    hostChart(
      () => this.canvas().nativeElement,
      (host) => {
        const years = this.projection().years;
        return buildLineChart(
          {
            labels: years.map((y) => yearLabel(y.year)),
            series: [
              { label: 'Mortgage owed', color: '--series-8', data: years.map((y) => y.mortgageBalance) },
              { label: 'Investments (after tax)', color: STRATEGIES[this.strategy()].color, data: years.map((y) => y.investments) },
            ],
            title: (index) => yearTitle(years[index].year),
            tickEvery: 5,
          },
          host,
        );
      },
    );
  }
}
