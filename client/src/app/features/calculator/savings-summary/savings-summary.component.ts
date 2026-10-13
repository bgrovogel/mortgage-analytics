import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { usd, usdCents } from '../../../core/formatting/format';
import { AmortizationResponse, HousingCosts, Payment } from '../../../core/models/amortization.models';
import { mortgageInsuranceName } from '../../../core/models/cost-categories';
import { buydownYears } from '../rate-plan/buydown-years';

/** Each tax, as the payment tile names it when it is the only one. */
const TAXES: readonly [keyof HousingCosts, string][] = [
  ['propertyTax', 'property tax'],
  ['schoolTax', 'school tax'],
  ['localTax', 'county/city tax'],
  ['mudTax', 'MUD tax'],
];

/** Headline numbers. These are stat tiles rather than a chart, because each one is a single value. */
@Component({
  selector: 'app-savings-summary',
  imports: [CurrencyPipe, DatePipe],
  template: `
    @let r = result();
    <!-- Each tile is a term, its value, and notes on the value (more dd elements: a dl allows only dt and dd). -->
    <dl class="tiles">
      @if (hasSavings()) {
        <div class="tile hero positive">
          <dt>Net savings from paying extra</dt>
          <dd data-testid="net-savings">{{ r.savings.netSavings | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
          @if (savingsDetail(); as detail) {
            <dd class="note" data-testid="savings-detail">{{ detail }}</dd>
          }
          <!-- &ngsp; keeps the space between the two spans, which Angular would otherwise drop as whitespace-only. -->
          <dd class="note">Total interest <span data-testid="total-interest">{{ r.accelerated.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</span>&ngsp;<span data-testid="total-interest-detail">instead of {{ r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</span></dd>
          @if (buydownNote(); as note) {
            <dd class="note" data-testid="interest-you-pay">{{ note }}</dd>
          }
        </div>
      } @else {
        <!-- Nothing extra is paid, so a $0 saving would say nothing: lead with what the loan costs instead. -->
        <div class="tile hero">
          <dt>Total interest over the loan</dt>
          <dd data-testid="total-interest">{{ r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
          <dd class="note" data-testid="total-interest-detail">Add an extra payment to see how much you could save.</dd>
          @if (buydownNote(); as note) {
            <dd class="note" data-testid="interest-you-pay">{{ note }}</dd>
          }
        </div>
      }
      <div class="tile payment">
        <dt>Required monthly payment</dt>
        <dd data-testid="total-monthly-payment">{{ firstPayment().total | currency }}</dd>
        <dd class="note">
          <span data-testid="monthly-payment">{{ firstPayment().loan | currency }}</span>&ngsp;<abbr title="principal and interest">P&amp;I</abbr>
          @if (firstPayment().costs.total > 0) {
            + {{ firstPayment().costs.total | currency }} <span data-testid="housing-costs-label">{{ housingCostsLabel() }}</span>
          }
        </dd>
        @if (r.buydown) {
          <dd class="note with-extra" data-testid="buydown-first-year">In year 1, with the buydown; {{ fromNoteRate() }}</dd>
        }
        @if (withExtra(); as extra) {
          <dd class="note with-extra" data-testid="with-extra">+ {{ extra.amount | currency: 'USD' : 'symbol' : '1.0-0' }} extra = {{ extra.total | currency }}</dd>
        }
      </div>
      <!-- When it is paid off, and how much sooner: one tile, so the date and the time saved are not said twice. -->
      <div class="tile">
        <dt>Paid off</dt>
        <dd data-testid="payoff-date">{{ r.savings.acceleratedPayoffDate | date: 'MMM yyyy' }}</dd>
        @if (r.savings.paymentsSaved > 0) {
          <dd class="note gain"><span data-testid="time-saved">{{ timeSaved() }}</span> sooner, instead of {{ r.savings.originalPayoffDate | date: 'MMM yyyy' }}</dd>
        } @else if (r.accelerated.recasts.length > 0) {
          <dd class="note" data-testid="same-payoff">Same date: a recast lowers the payment instead</dd>
        }
      </div>
      @if (r.accelerated.mortgageInsuranceEndDate; as pmiEnd) {
        <div class="tile">
          <dt>{{ insuranceName() }} ends</dt>
          <dd data-testid="pmi-end">{{ pmiEnd | date: 'MMM yyyy' }}</dd>
          @if (r.baseline.mortgageInsuranceEndDate !== pmiEnd) {
            <dd class="note gain" data-testid="pmi-sooner">{{ pmiSooner() }} sooner, instead of {{ r.baseline.mortgageInsuranceEndDate | date: 'MMM yyyy' }}</dd>
          } @else {
            <dd class="note">{{ r.purchase.downPaymentPercent }}% down</dd>
          }
          <!-- Automatic removal keeps to the original schedule, whatever is paid extra; asking at 80% does not. -->
          @if (r.pmiOtherChoice; as other) {
            <dd class="note ask" data-testid="pmi-other-choice">
              @if (other.removal === 'BorrowerRequested') {
                Ask your lender at 80%: ends {{ other.endDate | date: 'MMM yyyy' }}, saving {{ other.savedByAsking | currency: 'USD' : 'symbol' : '1.0-0' }}
              } @else {
                <!-- Automatic removal is the latest the law requires; some servicers drop it sooner, but none has to. -->
                If you don't ask, your servicer only has to remove it in {{ other.endDate | date: 'MMM yyyy' }}, costing {{ other.savedByAsking | currency: 'USD' : 'symbol' : '1.0-0' }} more
              }
            </dd>
          }
        </div>
      }
    </dl>

    @if (r.accelerated.recasts.length > 0) {
      <ul class="recasts" data-testid="recasts">
        @for (recast of r.accelerated.recasts; track recast.afterPaymentNumber) {
          <li>
            <strong>Recast after payment {{ recast.afterPaymentNumber }}</strong>:
            payment drops from {{ recast.previousPayment | currency }} to {{ recast.newPayment | currency }}
            starting {{ recast.effectiveDate | date: 'MMM yyyy' }}
            @if (recast.fee > 0) {
              ({{ recast.fee | currency: 'USD' : 'symbol' : '1.0-0' }} fee)
            }
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './savings-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingsSummaryComponent {
  /** The analysis to summarize. */
  readonly result = input.required<AmortizationResponse>();

  /**
   * On a loan already being paid, the payment due next: its housing costs have grown since the first payment, so the
   * tile shows it rather than the first. Null for a new loan.
   */
  readonly current = input<Payment | null>(null);

  /**
   * The extra principal in the first payment that has any (the next one, on a loan already being paid) and what that
   * payment comes to, or null when nothing extra is paid.
   */
  readonly withExtra = computed(() => {
    const first = this.result().accelerated.payments.find((p) => p.extraPrincipal > 0);
    return first ? { amount: first.extraPrincipal, total: first.totalOutlay } : null;
  });

  /**
   * The first payment due: principal and interest, and with housing costs. With a buydown it is year 1's reduced
   * payment, which is what the borrower actually pays at first.
   */
  readonly firstPayment = computed(() => {
    const r = this.result();
    const next = this.current();
    if (next) {
      const loan = next.scheduledPayment - next.buydownSubsidy;
      return { loan, total: loan + next.housingCosts, costs: next.costs };
    }
    const first = r.buydown?.years[0];
    const costs = r.baseline.monthlyHousingCosts;
    return first
      ? { loan: first.monthlyPayment, total: first.monthlyPayment + costs.total, costs }
      : { loan: r.baseline.monthlyPayment, total: r.baseline.totalMonthlyPayment, costs };
  });

  /**
   * Where a buydown's payment ends up, in the same terms as the tile (with that year's housing costs): "$3,160.61
   * from year 3". Every year in between is in the rate plan's table below. Empty without a buydown.
   */
  readonly fromNoteRate = computed(() => {
    const last = buydownYears(this.result())?.at(-1);
    return last ? `${usdCents(last.monthlyTotal)} ${last.label.toLowerCase()}` : '';
  });

  /** What the loan's mortgage insurance is called: MIP on an FHA loan, PMI otherwise. */
  readonly insuranceName = computed(() => mortgageInsuranceName(this.result().program));

  /**
   * What the first payment's housing costs are, in words: one or two by name ("property tax & insurance", or "MIP"
   * alone), and "housing costs" for more, so the line fits the tile; the breakdown below names every one. Only the
   * costs this loan has are named.
   */
  readonly housingCostsLabel = computed(() => {
    const c = this.firstPayment().costs;
    const taxes = TAXES.filter(([key]) => c[key] > 0).map(([, words]) => words);
    const parts = [
      ...(taxes.length > 1 ? ['property taxes'] : taxes),
      ...(c.pidAssessment > 0 ? ['PID'] : []),
      ...(c.homeownersInsurance > 0 ? ['insurance'] : []),
      ...(c.mortgageInsurance > 0 ? [this.insuranceName()] : []),
      ...(c.hoaDues > 0 ? ['HOA'] : []),
    ];
    return parts.length > 2 ? 'housing costs' : parts.join(' & ');
  });

  /**
   * With a buydown, who pays the interest shown: a subsidy from the seller or builder pays part of it (the loan's own
   * interest does not change), while one bought at closing only lowers the early payments. Said of the schedule the
   * headline shows: with extra payments, the accelerated one.
   */
  readonly buydownNote = computed(() => {
    const r = this.result();
    if (!r.buydown) return null;
    if (r.buydown.paidBy === 'Borrower') return 'Your buydown, paid for at closing, lowers the early payments, not the interest.';
    const schedule = this.hasSavings() ? r.accelerated : r.baseline;
    return `The seller's buydown pays ${usd(schedule.buydownSubsidy)} of it, so you pay ${usd(schedule.interestYouPay)}.`;
  });

  /** True when extra payments change anything; otherwise savings tiles would only show zeros. */
  readonly hasSavings = computed(() => {
    const s = this.result().savings;
    return s.netSavings !== 0 || s.paymentsSaved > 0 || s.totalExtraPrincipal > 0;
  });

  /** Payments saved, formatted as years and months. */
  readonly timeSaved = computed(() => formatMonths(this.result().savings.paymentsSaved));

  /** How much sooner extra payments end the mortgage insurance, e.g. "3 yr 2 mo", like the payoff tile's time saved. */
  readonly pmiSooner = computed(() => {
    const { baseline, accelerated } = this.result();
    const months = (iso: string | null | undefined) => (iso ? Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) : 0);
    return formatMonths(months(baseline.mortgageInsuranceEndDate) - months(accelerated.mortgageInsuranceEndDate));
  });

  /**
   * Where the net savings come from, e.g. "$79,801 interest + $6,531 PMI − $250 fees", or null when it is all
   * interest: the headline already says that number.
   */
  readonly savingsDetail = computed(() => {
    const s = this.result().savings;
    const parts = [`${usd(s.interestSaved)} interest`];
    if (s.mortgageInsuranceSaved > 0) parts.push(`+ ${usd(s.mortgageInsuranceSaved)} ${this.insuranceName()}`);
    if (s.recastFees > 0) parts.push(`− ${usd(s.recastFees)} fees`);
    return parts.length > 1 ? parts.join(' ') : null;
  });
}
