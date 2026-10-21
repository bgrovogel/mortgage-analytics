import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { usd, usdCents } from '../../../core/formatting/format';
import { CashToClose, LoanProgramType } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** The down payment that reaches each higher conventional limit, by that limit's percentage. */
const DOWN_FOR_LIMIT: Record<number, number> = { 6: 10, 9: 25 };

/** The most a seller may pay and why it is that, by the conventional limit's percentage: 2% is only ever an investment property's. */
function conventionalLimit(limitPercent: number, limit: string): string {
  const args = [limit, limitPercent];
  switch (limitPercent) {
    case 2: return t('A seller or builder may pay up to {0} of your costs: {1}% of the price, for an investment property.', args);
    case 3: return t('A seller or builder may pay up to {0} of your costs: {1}% of the price, with less than 10% down.', args);
    case 6: return t('A seller or builder may pay up to {0} of your costs: {1}% of the price, with 10% to 25% down.', args);
    case 9: return t('A seller or builder may pay up to {0} of your costs: {1}% of the price, with 25% or more down.', args);
    default: return t('A seller or builder may pay up to {0} of your costs: {1}% of the price.', args);
  }
}

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
  imports: [CurrencyPipe, TPipe],
  template: `
    <div class="lead">
      <h2 id="cash-to-close-title">{{ 'Cash to close' | t }}</h2>
      <p class="intro" data-testid="cash-to-close-intro">{{ intro() }}</p>
      @if (cash().unusedCredits > 0) {
        <p class="note" data-testid="unused-credits">
          {{ '{0} of the credits goes unused: credits pay closing costs, never the down payment.' | t: [unusedCredits()] }}
        </p>
      }
      <p class="note" data-testid="concession-limit">{{ concessionLimit() }}</p>
      @if (cash().concessions.overLimit > 0) {
        <p class="note warn" data-testid="concessions-over">
          {{ "That is {0} over the limit, which can't pay your costs: ask for it off the price instead." | t: [overLimit()] }}
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
          <th scope="row">{{ 'Cash to close' | t }}</th>
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
    return c.credits > 0
      ? t('Closing costs add {0} to the {1} down payment; credits take {2} off.', [usd(c.closingCosts), usd(c.downPayment), usd(c.credits)])
      : t('Closing costs add {0} to the {1} down payment.', [usd(c.closingCosts), usd(c.downPayment)]);
  });

  /** The most the seller may pay, why, and what they pay of it here. */
  readonly concessionLimit = computed(() => {
    const c = this.cash().concessions;
    const amount = usd(c.limit);
    const args = [amount, c.limitPercent];
    const type = this.program()?.type;
    const limit = type === 'Fha' ? t('A seller or builder may pay up to {0} of your costs: {1}% of the price on an FHA loan.', args)
      : type === 'Va' ? t('A seller or builder may pay up to {0} of your costs: {1}% of the price on a VA loan, besides the normal closing costs and points.', args)
        : conventionalLimit(c.limitPercent, amount);
    if (c.total <= 0) return limit;
    return `${limit} ${c.sellerBuydown > 0 ? t('Here they pay {0}, with the buydown.', [usd(c.total)]) : t('Here they pay {0}.', [usd(c.total)])}`;
  });

  /** How far the seller's offer goes beyond the limit. */
  readonly overLimit = computed(() => usd(this.cash().concessions.overLimit));

  /** The down payment that would raise a conventional limit, and to what; null when none would. */
  readonly nextTier = computed(() => {
    const next = this.cash().concessions.nextTier;
    return next
      ? t('With {0} down ({1}%), it would be {2}%: {3}.', [usd(next.downPayment), DOWN_FOR_LIMIT[next.limitPercent], next.limitPercent, usd(next.limit)])
      : null;
  });

  /** The unused credits, to the cent. */
  readonly unusedCredits = computed(() => usdCents(this.cash().unusedCredits));

  /** Each line that has an amount, the down payment always and credits last. */
  readonly lines = computed<Line[]>(() => {
    const c = this.cash();
    const all: Line[] = [
      { label: t('Loan costs'), detail: '', amount: c.loanCosts },
      { label: t('Other fees'), detail: '', amount: c.otherFees },
      { label: t('Prepaid interest'), detail: t('{0} days at {1}', [c.prepaidInterestDays, usdCents(c.dailyInterest)]), amount: c.prepaidInterest },
      { label: t('Homeowners insurance'), detail: t('the first year'), amount: c.homeownersInsurance },
      { label: t('Escrow deposit'), detail: t('{0} months at {1}', [c.escrowMonths, usdCents(c.monthlyEscrow)]), amount: c.escrowDeposit },
      { label: t('Temporary buydown'), detail: t('you pay for it'), amount: c.buydownCost },
      { label: t('Discount points'), detail: '', amount: c.discountPoints },
      { label: this.program()?.type === 'Va' ? t('VA funding fee') : t('FHA upfront MIP'), detail: t('not added to the loan'), amount: c.upfrontMortgageFee },
      { label: t('Seller credits'), detail: c.concessions.overLimit > 0 ? t('up to the limit') : '', amount: c.sellerCredits, credit: true },
      { label: t('Lender credits'), detail: '', amount: c.lenderCredits, credit: true },
    ];
    return [{ label: t('Down payment'), detail: '', amount: c.downPayment }, ...all.filter((line) => line.amount > 0)];
  });
}
