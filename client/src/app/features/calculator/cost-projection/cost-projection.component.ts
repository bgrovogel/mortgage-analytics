import { ChangeDetectionStrategy, Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { hostChart } from '../../../core/charts/chart-host';
import { LineSeries, buildLineChart, currency } from '../../../core/charts/line-chart';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { COST_CATEGORIES } from '../../../core/models/cost-categories';

type View = 'costs' | 'value';

/**
 * The long-term picture, year by year over the full term:
 * - "Yearly costs": one line per tax, insurance, PMI and dues category, showing rises and drop-offs
 *   (PMI ending, a PID paid off).
 * - "Home value": market value against taxable value, which shows the homestead cap at work.
 * The two views are separate charts because their scales differ by two orders of magnitude.
 */
@Component({
  selector: 'app-cost-projection',
  template: `
    <figure>
      <div class="header">
        <figcaption id="projection-title">{{ view() === 'costs' ? 'Projected yearly taxes & costs' : 'Home value vs. taxable value' }}</figcaption>
        <div class="toggle" role="group" aria-label="Projection to show">
          <button type="button" [attr.aria-pressed]="view() === 'costs'" (click)="view.set('costs')"
                  data-testid="projection-costs">Yearly costs</button>
          <button type="button" [attr.aria-pressed]="view() === 'value'" (click)="view.set('value')"
                  data-testid="projection-value">Home value</button>
        </div>
      </div>
      <div class="canvas-wrap">
        <canvas #canvas role="img" aria-labelledby="projection-title" data-testid="projection-chart"></canvas>
      </div>
      <p class="note" data-testid="projection-note">{{ note() }}</p>
    </figure>
  `,
  styleUrl: './cost-projection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostProjectionComponent {
  /** The analysis whose projection is plotted. */
  readonly result = input.required<AmortizationResponse>();

  /** Which view is shown. */
  readonly view = signal<View>('costs');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** A one-line takeaway under the chart, e.g. how much taxes rise from year 1 to the last year. */
  readonly note = computed(() => {
    const projection = this.result().projection;
    if (projection.length === 0) return '';
    const first = projection[0];
    const last = projection[projection.length - 1];
    if (this.view() === 'value') {
      const gap = last.marketValue - last.taxableValue;
      return gap > 0
        ? `By year ${last.year}, the homestead cap keeps ${currency.format(gap)} of value off the tax roll.`
        : 'Taxable value tracks market value (no homestead cap, or growth below the cap).';
    }
    return `Yearly taxes & costs go from ${currency.format(first.costs.total)} in year 1 to ${currency.format(last.costs.total)} in year ${last.year}.`;
  });

  constructor() {
    hostChart(
      () => this.canvas().nativeElement,
      (host) => {
        const projection = this.result().projection;
        const labels = projection.map((y) => `Year ${y.year}`);
        const startYear = (i: number) => new Date(projection[i].startDate).getUTCFullYear();

        if (this.view() === 'value') {
          return buildLineChart(
            {
              labels,
              series: [
                { label: 'Market value', color: '--series-1', data: projection.map((y) => y.marketValue) },
                { label: 'Taxable value', color: '--series-2', data: projection.map((y) => y.taxableValue), dashed: true },
              ],
              title: (i, label) => `${label} (from ${startYear(i)})`,
            },
            host,
          );
        }

        const series: LineSeries[] = COST_CATEGORIES
          .filter((c) => projection.some((y) => y.costs[c.key] > 0))
          .map((c) => ({ label: c.label, color: c.color, data: projection.map((y) => y.costs[c.key]) }));

        return buildLineChart(
          {
            labels,
            series,
            title: (i, label) => `${label} (from ${startYear(i)})`,
            footer: (i) => `Total: ${currency.format(projection[i].costs.total)}`,
          },
          host,
        );
      },
    );
  }
}
