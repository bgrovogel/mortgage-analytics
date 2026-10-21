import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { monthOf } from '../../../core/formatting/format';
import { Payment } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';

/** How many payments the ledger shows at once: enough to read what the next months look like. */
export const LEDGER_ROWS = 6;

/**
 * A few payments from a month on, as a ledger: the date, what is paid, how much of it is principal and interest, and
 * what is owed after. Mono figures, right aligned, the date the row header, so it reads as the table it is (UI blueprint,
 * pillar 2). The chart's scrubber chooses where it starts.
 */
@Component({
  selector: 'app-payment-ledger',
  imports: [DecimalPipe, TPipe],
  template: `
    <div class="head">
      <h3 id="ledger-title">{{ 'Every payment' | t }}</h3>
      <span class="from">{{ 'Follows the scrubber · {0} on' | t: [from()] }}</span>
    </div>
    <div class="scroll" role="region" tabindex="0" aria-labelledby="ledger-title" data-testid="ledger">
      <table>
        <caption class="visually-hidden">{{ 'Payments from {0}, with extra principal where it is paid' | t: [from()] }}</caption>
        <thead>
          <tr>
            <th scope="col" class="date">{{ 'Date' | t }}</th>
            <th scope="col" class="paid">{{ 'Payment' | t }}</th>
            <th scope="col">{{ 'Principal' | t }}</th>
            <th scope="col">{{ 'Interest' | t }}</th>
            <th scope="col">{{ 'Balance' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.paymentNumber; let first = $first) {
            <tr [class.at]="first">
              <th scope="row" class="date">{{ date(row) }}</th>
              <td class="paid">{{ row.scheduledPayment + row.extraPrincipal | number: '1.2-2' }}</td>
              <td class="principal">{{ row.principal + row.extraPrincipal | number: '1.2-2' }}</td>
              <td class="interest">{{ row.interest | number: '1.2-2' }}</td>
              <td>{{ row.remainingBalance | number: '1.2-2' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './payment-ledger.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentLedgerComponent {
  /** Every payment of the schedule shown. */
  readonly payments = input.required<readonly Payment[]>();

  /** The month (1 is the first payment) the ledger starts at. */
  readonly month = input.required<number>();

  /** The rows shown: a few payments from the month on. */
  protected readonly rows = computed(() => this.payments().slice(Math.max(0, this.month() - 1), Math.max(0, this.month() - 1) + LEDGER_ROWS));

  /** The month the ledger starts at, in words. */
  protected readonly from = computed(() => {
    const first = this.rows()[0];
    return first ? monthOf(first.dueDate) : '';
  });

  protected date(row: Payment): string {
    return monthOf(row.dueDate);
  }
}
