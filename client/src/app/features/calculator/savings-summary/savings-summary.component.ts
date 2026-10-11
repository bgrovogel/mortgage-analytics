import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { usd } from '../../../core/formatting/format';
import { AmortizationResponse, HousingCosts } from '../../../core/models/amortization.models';

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
        <div class="tile hero">
          <dt>Net savings from paying extra</dt>
          <dd data-testid="net-savings">{{ r.savings.netSavings | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
          @if (savingsDetail(); as detail) {
            <dd class="note" data-testid="savings-detail">{{ detail }}</dd>
          }
          <!-- &ngsp; keeps the space between the two spans, which Angular would otherwise drop as whitespace-only. -->
          <dd class="note">Total interest <span data-testid="total-interest">{{ r.accelerated.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</span>&ngsp;<span data-testid="total-interest-detail">instead of {{ r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</span></dd>
        </div>
      } @else {
        <!-- Nothing extra is paid, so a $0 saving would say nothing: lead with what the loan costs instead. -->
        <div class="tile hero">
          <dt>Total interest over the loan</dt>
          <dd data-testid="total-interest">{{ r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
          <dd class="note" data-testid="total-interest-detail">Add an extra payment to see how much you could save.</dd>
        </div>
      }
      <div class="tile">
        <dt>Required monthly payment</dt>
        <dd data-testid="total-monthly-payment">{{ firstPayment().total | currency }}</dd>
        <dd class="note">
          <span data-testid="monthly-payment">{{ firstPayment().loan | currency }}</span> principal &amp; interest
          @if (r.baseline.monthlyHousingCosts.total > 0) {
            + {{ r.baseline.monthlyHousingCosts.total | currency }} <span data-testid="housing-costs-label">{{ housingCostsLabel() }}</span>
          }
        </dd>
        @if (r.buydown) {
          <dd class="note with-extra" data-testid="buydown-first-year">In year 1, with the buydown</dd>
        }
        @if (withExtra(); as extra) {
          <dd class="note with-extra" data-testid="with-extra">+ {{ extra.amount | currency: 'USD' : 'symbol' : '1.0-0' }} extra = {{ extra.total | currency }}</dd>
        }
      </div>
      <!-- When it is paid off, and how much sooner: one tile, so the date and the time saved are not said twice. -->
      <div class="tile" [class.highlight]="r.savings.paymentsSaved > 0">
        <dt>Paid off</dt>
        <dd data-testid="payoff-date">{{ r.savings.acceleratedPayoffDate | date: 'MMM yyyy' }}</dd>
        @if (r.savings.paymentsSaved > 0) {
          <dd class="note"><span data-testid="time-saved">{{ timeSaved() }}</span> sooner, instead of {{ r.savings.originalPayoffDate | date: 'MMM yyyy' }}</dd>
        } @else if (r.accelerated.recasts.length > 0) {
          <dd class="note" data-testid="same-payoff">Same date: a recast lowers the payment instead</dd>
        }
      </div>
      @if (r.accelerated.mortgageInsuranceEndDate; as pmiEnd) {
        <div class="tile">
          <dt>PMI ends</dt>
          <dd data-testid="pmi-end">{{ pmiEnd | date: 'MMM yyyy' }}</dd>
          @if (r.baseline.mortgageInsuranceEndDate !== pmiEnd) {
            <dd class="note">instead of {{ r.baseline.mortgageInsuranceEndDate | date: 'MMM yyyy' }}</dd>
          } @else {
            <dd class="note">{{ r.purchase.downPaymentPercent }}% down</dd>
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
    const first = r.buydown?.years[0];
    return first
      ? { loan: first.monthlyPayment, total: first.monthlyPayment + r.baseline.monthlyHousingCosts.total }
      : { loan: r.baseline.monthlyPayment, total: r.baseline.totalMonthlyPayment };
  });

  /**
   * What the first payment's housing costs are made of, in words: "property tax, insurance, PMI & HOA". Only the
   * costs this loan has are named, so a loan with no PMI or HOA doesn't mention them.
   */
  readonly housingCostsLabel = computed(() => {
    const c = this.result().baseline.monthlyHousingCosts;
    const taxes = TAXES.filter(([key]) => c[key] > 0).map(([, words]) => words);
    const parts = [
      ...(taxes.length > 1 ? ['property taxes'] : taxes),
      ...(c.pidAssessment > 0 ? ['PID'] : []),
      ...(c.homeownersInsurance > 0 ? ['insurance'] : []),
      ...(c.mortgageInsurance > 0 ? ['PMI'] : []),
      ...(c.hoaDues > 0 ? ['HOA'] : []),
    ];
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}` : (parts[0] ?? '');
  });

  /** True when extra payments change anything; otherwise savings tiles would only show zeros. */
  readonly hasSavings = computed(() => {
    const s = this.result().savings;
    return s.netSavings !== 0 || s.paymentsSaved > 0 || s.totalExtraPrincipal > 0;
  });

  /** Payments saved, formatted as years and months. */
  readonly timeSaved = computed(() => formatMonths(this.result().savings.paymentsSaved));

  /**
   * Where the net savings come from, e.g. "$79,801 interest + $6,531 PMI − $250 fees", or null when it is all
   * interest: the headline already says that number.
   */
  readonly savingsDetail = computed(() => {
    const s = this.result().savings;
    const parts = [`${usd(s.interestSaved)} interest`];
    if (s.mortgageInsuranceSaved > 0) parts.push(`+ ${usd(s.mortgageInsuranceSaved)} PMI`);
    if (s.recastFees > 0) parts.push(`− ${usd(s.recastFees)} fees`);
    return parts.length > 1 ? parts.join(' ') : null;
  });
}
