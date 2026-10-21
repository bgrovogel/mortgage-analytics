import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ScheduleColumn, ScheduleRow } from './schedule-model';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/**
 * What the whole schedule adds up to, so the table need not be scrolled to its foot to know: the three figures that
 * matter in a line, and every total (each cost, whichever columns the table shows) one step away in a disclosure.
 */
@Component({
  selector: 'app-schedule-totals',
  imports: [CurrencyPipe, TPipe],
  template: `
    @let t = totals();
    <!-- Everything this schedule costs, whichever columns are showing. -->
    <p class="scope" data-testid="lifetime-scope">
      {{ 'Totals until the loan is paid off, after {0} payments. Taxes and insurance are counted to that date only.' | t: [payments()] }}
    </p>
    <p class="headline" data-testid="lifetime-headline">
      <span>{{ 'Loan repaid' | t }} <strong>{{ t.principal + t.extraPrincipal | currency }}</strong></span>&ngsp;
      <span>{{ 'Interest' | t }} <strong>{{ t.interest | currency }}</strong></span>&ngsp;
      <span class="all">{{ 'Everything paid' | t }} <strong>{{ t.totalOutlay | currency }}</strong></span>
    </p>
    <details class="every" data-testid="lifetime-more">
      <summary>{{ 'Every total' | t }}</summary>
      <dl class="lifetime" data-testid="lifetime-totals" [attr.aria-label]="'Totals over the whole schedule' | t">
        <div><dt>{{ 'Loan repaid' | t }} </dt><dd>{{ t.principal + t.extraPrincipal | currency }}</dd></div>
        @for (column of columns(); track column.key) {
          @if (column.key !== 'housingCosts' && column.key !== 'totalOutlay') {
            <div><dt>{{ label(column) }} </dt><dd>{{ column.value(t) | currency }}</dd></div>
          }
        }
        <div class="all"><dt>{{ 'Everything paid' | t }} </dt><dd>{{ t.totalOutlay | currency }}</dd></div>
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
    if (column.key === 'principal') return t('Principal, as scheduled');
    if (column.key === 'extraPrincipal') return t('Extra principal');
    return column.label;
  }
}
