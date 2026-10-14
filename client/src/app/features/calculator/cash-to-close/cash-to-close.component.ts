import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { usd, usdCents } from '../../../core/formatting/format';
import { CashToClose, LoanProgramType } from '../../../core/models/amortization.models';

/** The down payment that reaches each higher conventional limit, by that limit's percentage. */
const DOWN_FOR_LIMIT: Record<number, number> = { 6: 10, 9: 25 };

/** Why a conventional loan's limit is what it is, by its percentage. */
const CONVENTIONAL_TIER: Record<number, string> = { 3: ', with less than 10% down', 6: ', with 10% to 25% down', 9: ', with 25% or more down' };

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
 * zero are left out, apart from the down payment. Then the most a seller or builder may pay, and whether this does.
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
      <p class="note" data-testid="concession-limit">{{ concessionLimit() }}</p>
      @if (cash().concessions.overLimit > 0) {
        <p class="note warn" data-testid="concessions-over">
          That is {{ overLimit() }} over the limit, which can't pay your costs: ask for it off the price instead.
        </p>
      }
      @if (nextTier(); as next) {
        <p class="note" data-testid="concession-next">{{ next }}</p>
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

  /** The loan's program, which names an upfront fee paid at closing; null for a conventional loan. */
  readonly program = input<{ type: LoanProgramType } | null | undefined>(null);

  /** What closing adds to the down payment, and what credits take off, in one sentence. */
  readonly intro = computed(() => {
    const c = this.cash();
    const credits = c.credits > 0 ? `; credits take ${usd(c.credits)} off` : '';
    return `Closing costs add ${usd(c.closingCosts)} to the ${usd(c.downPayment)} down payment${credits}.`;
  });

  /** The most the seller may pay, why, and what they pay of it here. */
  readonly concessionLimit = computed(() => {
    const c = this.cash().concessions;
    const why = this.program()?.type === 'Fha' ? ' on an FHA loan'
      : this.program()?.type === 'Va' ? ' on a VA loan, besides the normal closing costs and points'
        : CONVENTIONAL_TIER[c.limitPercent];
    const paid = c.total > 0 ? ` Here they pay ${usd(c.total)}${c.sellerBuydown > 0 ? ', with the buydown' : ''}.` : '';
    return `A seller or builder may pay up to ${usd(c.limit)} of your costs: ${c.limitPercent}% of the price${why}.${paid}`;
  });

  /** How far the seller's offer goes beyond the limit. */
  readonly overLimit = computed(() => usd(this.cash().concessions.overLimit));

  /** The down payment that would raise a conventional limit, and to what; null when none would. */
  readonly nextTier = computed(() => {
    const next = this.cash().concessions.nextTier;
    return next
      ? `With ${usd(next.downPayment)} down (${DOWN_FOR_LIMIT[next.limitPercent]}%), it would be ${next.limitPercent}%: ${usd(next.limit)}.`
      : null;
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
      { label: 'Discount points', detail: '', amount: c.discountPoints },
      { label: this.program()?.type === 'Va' ? 'VA funding fee' : 'FHA upfront MIP', detail: 'not added to the loan', amount: c.upfrontMortgageFee },
      { label: 'Seller credits', detail: c.concessions.overLimit > 0 ? 'up to the limit' : '', amount: c.sellerCredits, credit: true },
      { label: 'Lender credits', detail: '', amount: c.lenderCredits, credit: true },
    ];
    return [{ label: 'Down payment', detail: '', amount: c.downPayment }, ...all.filter((line) => line.amount > 0)];
  });
}
