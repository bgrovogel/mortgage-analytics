import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { usd, usdCents } from '../../../core/formatting/format';
import { CashToClose } from '../../../core/models/amortization.models';

/** One line of the cash to close: what it is, how it was worked out (when that helps), and the amount. */
interface Line {
  label: string;
  detail: string;
  amount: number;
  /** True for credits, which come off the total. */
  credit?: boolean;
}

/**
 * What the buyer brings to closing, line by line as a Loan Estimate lists it: the down payment, the fees, the
 * prepaids and escrow (with how each was worked out), a buydown the buyer pays for, and the credits. Lines that are
 * zero are left out, apart from the down payment.
 */
@Component({
  selector: 'app-cash-to-close',
  imports: [CurrencyPipe],
  template: `
    <div class="lead">
      <h2 id="cash-to-close-title">Cash to close</h2>
      <p class="intro" data-testid="cash-to-close-intro">{{ intro() }}</p>
      @if (cash().unusedCredits > 0) {
        <p class="note" data-testid="unused-credits">
          {{ unusedCredits() }} of the credits goes unused: credits pay closing costs, never the down payment.
        </p>
      }
    </div>
    <table aria-labelledby="cash-to-close-title" data-testid="cash-to-close">
      <tbody>
        @for (line of lines(); track line.label) {
          <tr>
            <th scope="row">{{ line.label }}@if (line.detail) {<span class="detail">{{ line.detail }}</span>}</th>
            <td>{{ line.credit ? '−' : '' }}{{ line.amount | currency }}</td>
          </tr>
        }
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Cash to close</th>
          <td data-testid="cash-to-close-total">{{ cash().total | currency }}</td>
        </tr>
      </tfoot>
    </table>
  `,
  styleUrl: './cash-to-close.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashToCloseComponent {
  /** The API's cash to close. */
  readonly cash = input.required<CashToClose>();

  /** What closing adds to the down payment, and what credits take off, in one sentence. */
  readonly intro = computed(() => {
    const c = this.cash();
    const credits = c.credits > 0 ? `; credits take ${usd(c.credits)} off` : '';
    return `Closing costs add ${usd(c.closingCosts)} to the ${usd(c.downPayment)} down payment${credits}.`;
  });

  /** The unused credits, to the cent. */
  readonly unusedCredits = computed(() => usdCents(this.cash().unusedCredits));

  /** Each line that has an amount, the down payment always and credits last. */
  readonly lines = computed<Line[]>(() => {
    const c = this.cash();
    const all: Line[] = [
      { label: 'Loan costs', detail: '', amount: c.loanCosts },
      { label: 'Other fees', detail: '', amount: c.otherFees },
      { label: 'Prepaid interest', detail: `${c.prepaidInterestDays} days at ${usdCents(c.dailyInterest)}`, amount: c.prepaidInterest },
      { label: 'Homeowners insurance', detail: 'the first year', amount: c.homeownersInsurance },
      { label: 'Escrow deposit', detail: `${c.escrowMonths} months at ${usdCents(c.monthlyEscrow)}`, amount: c.escrowDeposit },
      { label: 'Temporary buydown', detail: 'you pay for it', amount: c.buydownCost },
      { label: 'Credits', detail: 'seller and lender', amount: c.credits, credit: true },
    ];
    return [{ label: 'Down payment', detail: '', amount: c.downPayment }, ...all.filter((line) => line.amount > 0)];
  });
}
