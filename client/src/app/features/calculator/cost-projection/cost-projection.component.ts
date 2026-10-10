import { ChangeDetectionStrategy, Component, ElementRef, computed, input, viewChild } from '@angular/core';
import { hostChart } from '../../../core/charts/chart-host';
import { LineSeries, buildLineChart, currency } from '../../../core/charts/line-chart';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { COST_CATEGORIES } from '../../../core/models/cost-categories';
import { valueLines, valueNote } from './value-lines';

/** The two views of the projection. */
export type ProjectionView = 'costs' | 'value';

/**
 * The long-term picture, year by year over the full term:
 * - "Yearly costs": stacked areas, one per tax, insurance, PMI and dues category; the top edge is the
 *   total, and rises and drop-offs (PMI ending, a PID paid off) show as bands growing or vanishing.
 * - "Home value": market value, the capped assessed value, and what each tax is charged on after its
 *   own exemptions (see value-lines.ts).
 * The two views are separate charts because their scales differ by two orders of magnitude.
 */
@Component({
  selector: 'app-cost-projection',
  template: `
    <figure>
      <figcaption [id]="'projection-title-' + view()">{{ view() === 'costs' ? 'Projected yearly taxes & costs' : 'Home value, and what each tax is charged on' }}</figcaption>
      <div class="canvas-wrap">
        <canvas #canvas role="img" [attr.aria-labelledby]="'projection-title-' + view()" [attr.data-testid]="'projection-chart-' + view()"></canvas>
      </div>
      <p class="note" [attr.data-testid]="'projection-note-' + view()">{{ note() }}</p>
    </figure>
  `,
  styleUrl: './cost-projection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostProjectionComponent {
  /** The analysis whose projection is plotted. */
  readonly result = input.required<AmortizationResponse>();

  /** Which view is shown; the tabs around the chart choose it. */
  readonly view = input<ProjectionView>('costs');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** A one-line takeaway under the chart, e.g. how much taxes rise from year 1 to the last year. */
  readonly note = computed(() => {
    const projection = this.result().projection;
    if (projection.length === 0) return '';
    const first = projection[0];
    const last = projection[projection.length - 1];
    if (this.view() === 'value') return valueNote(projection);
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
              series: valueLines(projection),
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
            // A part-to-whole over time: stacked areas show each cost and, along the top edge, the total.
            stacked: true,
          },
          host,
        );
      },
    );
  }
}
