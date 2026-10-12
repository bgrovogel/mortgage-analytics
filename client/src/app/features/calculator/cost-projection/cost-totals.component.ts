import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { usd } from '../../../core/formatting/format';
import { LoanProgramType, YearProjection } from '../../../core/models/amortization.models';
import { costCategoriesFor } from '../../../core/models/cost-categories';
import { costTotals, startingYear } from './cost-totals';

/**
 * The projection's quick numbers: for a chosen year, each tax and cost that year, everything paid through it, and
 * the whole loan. The year starts where the loan is now (year 1 for a new one); the picker, or a click on the chart,
 * chooses another.
 */
@Component({
  selector: 'app-cost-totals',
  template: `
    @let t = totals();
    <section class="cost-totals" aria-labelledby="cost-totals-title">
      <header>
        <h3 id="cost-totals-title">Taxes &amp; costs at a glance</h3>
        <label class="pick">
          <span>Year</span>
          <select data-testid="cost-totals-year" (change)="pick($event)">
            @for (y of projection(); track y.year) {
              <option [value]="y.year" [selected]="y.year === shown()">Year {{ y.year }} ({{ calendarYear(y) }})</option>
            }
          </select>
        </label>
      </header>

      <div class="table-wrap">
        <table data-testid="cost-totals">
          <thead>
            <tr>
              <th scope="col">Cost</th>
              <th scope="col">Year {{ shown() }} ({{ calendarYear(projection()[shown() - 1]) }})</th>
              <th scope="col">Through year {{ shown() }}</th>
              <th scope="col">All {{ projection().length }} years</th>
            </tr>
          </thead>
          <tbody>
            @for (row of t.rows; track row.label) {
              <tr>
                <th scope="row"><i [style.background]="'var(' + row.color + ')'"></i>{{ row.label }}</th>
                <td>{{ money(row.thisYear) }}</td>
                <td>{{ money(row.toDate) }}</td>
                <td>{{ money(row.wholeLoan) }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr data-testid="cost-totals-total">
              <th scope="row">Total</th>
              <td>{{ money(t.total.thisYear) }} <small>{{ money(t.total.monthly) }}/mo</small></td>
              <td>{{ money(t.total.toDate) }}</td>
              <td>{{ money(t.total.wholeLoan) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="note">These continue after the loan is paid off, so they run the full term. Click a year on the chart to see it here.</p>
    </section>
  `,
  styleUrl: './cost-totals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostTotalsComponent {
  /** The yearly projection (one row per loan year). */
  readonly projection = input.required<readonly YearProjection[]>();

  /** The loan's program, which names its mortgage insurance; null for a conventional loan. */
  readonly program = input<{ type: LoanProgramType } | null | undefined>(null);

  /** The year chosen (1-based), shared with the chart; null until someone chooses, which shows the starting year. */
  readonly year = model<number | null>(null);

  /** The year on show: the one chosen, or where the loan is now. */
  protected readonly shown = computed(() => this.year() ?? startingYear(this.projection(), new Date()));

  protected readonly totals = computed(() => costTotals(this.projection(), this.shown(), costCategoriesFor(this.program())));

  protected readonly money = usd;

  protected calendarYear(year: YearProjection): number {
    return new Date(year.startDate).getUTCFullYear();
  }

  protected pick(event: Event): void {
    this.year.set(Number((event.target as HTMLSelectElement).value));
  }
}
