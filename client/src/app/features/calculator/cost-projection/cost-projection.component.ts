import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ScrubChartComponent, ScrubChartSpec, ScrubSeries } from '../../../core/charts/scrub-chart.component';
import { usd } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { costCategoriesFor } from '../../../core/models/cost-categories';
import { equityFooter, equityLines, equityNote } from './equity-lines';
import { valueBills, valueLines, valueNote } from './value-lines';
import { t } from '../../../core/i18n/i18n';

/** The three views of the projection. */
export type ProjectionView = 'costs' | 'value' | 'equity';

/** Each view's caption. */
const caption = (view: ProjectionView): string =>
  ({
    costs: t('Projected yearly taxes & costs'),
    value: t('Home value, and what each tax is charged on'),
    equity: t('Equity: what is yours, and what is owed'),
  })[view];

/**
 * The long-term picture, year by year over the full term:
 * - "Yearly costs": stacked areas, one per tax, insurance, PMI and dues category; the top edge is the
 *   total, and rises and drop-offs (PMI ending, a PID paid off) show as bands growing or vanishing.
 * - "Home value": market value, the capped assessed value, and what each tax is charged on after its
 *   own exemptions (see value-lines.ts).
 * - "Equity": what is owed and what is yours, stacked, so the top edge is the home's value (see equity-lines.ts).
 * The views are separate charts because their scales differ by two orders of magnitude.
 */
@Component({
  selector: 'app-cost-projection',
  imports: [ScrubChartComponent],
  template: `
    <app-scrub-chart [title]="caption()" [spec]="spec()" [testId]="'projection-chart-' + view()" (picked)="pick($event)" />
    <p class="note" [attr.data-testid]="'projection-note-' + view()">{{ note() }}</p>
  `,
  styleUrl: './cost-projection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostProjectionComponent {
  /** The analysis whose projection is plotted. */
  readonly result = input.required<AmortizationResponse>();

  /** Which view is shown; the tabs around the chart choose it. */
  readonly view = input<ProjectionView>('costs');

  /** The loan year clicked on the costs chart, so the page can show its quick numbers. */
  readonly yearPicked = output<number>();


  /** The chart's caption. */
  protected readonly caption = computed(() => caption(this.view()));

  /** A one-line takeaway under the chart, e.g. how much taxes rise from year 1 to the last year. */
  readonly note = computed(() => {
    const projection = this.result().projection;
    if (projection.length === 0) return '';
    const first = projection[0];
    const last = projection[projection.length - 1];
    if (this.view() === 'value') return valueNote(projection);
    if (this.view() === 'equity') return equityNote(projection);
    return t('Yearly taxes & costs go from {0} in year 1 to {1} in year {2}.', [usd(first.costs.total), usd(last.costs.total), last.year]);
  });

  /** What is drawn for the view shown. */
  readonly spec = computed<ScrubChartSpec>(() => {
    const projection = this.result().projection;
    const labels = projection.map((y) => t('Year {0}', [y.year]));
    const startYear = (i: number) => new Date(projection[i].startDate).getUTCFullYear();

    if (this.view() === 'equity') {
      return {
        labels,
        series: equityLines(projection),
        footer: (i) => equityFooter(projection[i]),
        title: (i, label) => t('{0} (from {1})', [label, startYear(i)]),
        // Owed and yours add up to the home's value, which is the top edge.
        stacked: true,
        tickEvery: 5,
      };
    }

    if (this.view() === 'value') {
      return {
        labels,
        series: valueLines(projection),
        // Each year's bills, so every line can be checked against the tax it produces.
        footer: (i) => valueBills(projection[i]),
        title: (i, label) => t('{0} (from {1})', [label, startYear(i)]),
        tickEvery: 5,
      };
    }

    const series: ScrubSeries[] = costCategoriesFor(this.result().program)
      .filter((c) => projection.some((y) => y.costs[c.key] > 0))
      .map((c) => ({ label: c.label, color: c.color, data: projection.map((y) => y.costs[c.key]) }));
    return {
      labels,
      series,
      title: (i, label) => t('{0} (from {1})', [label, startYear(i)]),
      footer: (i) => t('Total: {0}', [usd(projection[i].costs.total)]),
      // A part-to-whole over time: stacked areas show each cost and, along the top edge, the total.
      stacked: true,
      tickEvery: 5,
    };
  });

  /** The year the reader scrubbed to on the costs chart, passed on so the page can show its quick numbers. */
  protected pick(index: number): void {
    const year = this.result().projection[index]?.year;
    if (this.view() === 'costs' && year !== undefined) this.yearPicked.emit(year);
  }
}
