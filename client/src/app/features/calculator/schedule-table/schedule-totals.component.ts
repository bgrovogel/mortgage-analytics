import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ScheduleColumn, ScheduleRow } from './schedule-model';

/**
 * What the whole schedule adds up to, so the table need not be scrolled to its foot to know: the three figures that
 * matter in a line, and every total (each cost, whichever columns the table shows) one step away in a disclosure.
 */
@Component({
  selector: 'app-schedule-totals',
  imports: [CurrencyPipe],
  template: `
    @let t = totals();
    <!-- Everything this schedule costs, whichever columns are showing. -->
    <p class="scope" data-testid="lifetime-scope">
      Totals until the loan is paid off, after {{ payments() }} payments. Taxes and insurance are counted to that date only.
    </p>
    <p class="headline" data-testid="lifetime-headline">
      <span>Loan repaid <strong>{{ t.principal + t.extraPrincipal | currency }}</strong></span>&ngsp;
      <span>Interest <strong>{{ t.interest | currency }}</strong></span>&ngsp;
      <span class="all">Everything paid <strong>{{ t.totalOutlay | currency }}</strong></span>
    </p>
    <details class="every" data-testid="lifetime-more">
      <summary>Every total</summary>
      <dl class="lifetime" data-testid="lifetime-totals" aria-label="Totals over the whole schedule">
        <div><dt>Loan repaid </dt><dd>{{ t.principal + t.extraPrincipal | currency }}</dd></div>
        @for (column of columns(); track column.key) {
          @if (column.key !== 'housingCosts' && column.key !== 'totalOutlay') {
            <div><dt>{{ label(column) }} </dt><dd>{{ column.value(t) | currency }}</dd></div>
          }
        }
        <div class="all"><dt>Everything paid </dt><dd>{{ t.totalOutlay | currency }}</dd></div>
      </dl>
    </details>
  `,
  styleUrl: './schedule-totals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTotalsComponent {
  /** The whole schedule added up as one row. */
  readonly totals = input.required<ScheduleRow>();

  /** Every money column the schedule has, in order. */
  readonly columns = input.required<readonly ScheduleColumn[]>();

  /** How many payments the totals cover. */
  readonly payments = input.required<number>();

  /**
   * What a column's lifetime total is called. "Principal" alone reads as the loan, but it leaves out the extra
   * payments, which the "Loan repaid" total beside it adds back.
   */
  protected label(column: ScheduleColumn): string {
    if (column.key === 'principal') return 'Principal, as scheduled';
    if (column.key === 'extraPrincipal') return 'Extra principal';
    return column.label;
  }
}
