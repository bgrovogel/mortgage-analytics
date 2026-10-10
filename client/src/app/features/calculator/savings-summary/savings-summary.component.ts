import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { usd } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';

/** Headline numbers. These are stat tiles rather than a chart, because each one is a single value. */
@Component({
  selector: 'app-savings-summary',
  imports: [CurrencyPipe, DatePipe],
  template: `
    @let r = result();
    <dl class="tiles">
      @if (hasSavings()) {
        <div class="tile hero">
          <dt>Net savings from paying extra</dt>
          <dd data-testid="net-savings">{{ r.savings.netSavings | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
          @if (savingsDetail(); as detail) {
            <small data-testid="savings-detail">{{ detail }}</small>
          }
          <!-- &ngsp; keeps the space between the two spans, which Angular would otherwise drop as whitespace-only. -->
          <small>Total interest <span data-testid="total-interest">{{ r.accelerated.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</span>&ngsp;<span data-testid="total-interest-detail">instead of {{ r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</span></small>
        </div>
      } @else {
        <!-- Nothing extra is paid, so a $0 saving would say nothing: lead with what the loan costs instead. -->
        <div class="tile hero">
          <dt>Total interest over the loan</dt>
          <dd data-testid="total-interest">{{ r.baseline.totalInterest | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
          <small data-testid="total-interest-detail">Add an extra payment to see how much you could save.</small>
        </div>
      }
      <div class="tile">
        <dt>Required monthly payment</dt>
        <dd data-testid="total-monthly-payment">{{ r.baseline.totalMonthlyPayment | currency }}</dd>
        <small>
          <span data-testid="monthly-payment">{{ r.baseline.monthlyPayment | currency }}</span> principal &amp; interest
          @if (r.baseline.monthlyHousingCosts.total > 0) {
            + {{ r.baseline.monthlyHousingCosts.total | currency }} taxes &amp; fees
          }
        </small>
        @if (withExtra(); as extra) {
          <small class="with-extra" data-testid="with-extra">+ {{ extra.amount | currency: 'USD' : 'symbol' : '1.0-0' }} extra = {{ extra.total | currency }}</small>
        }
      </div>
      <!-- When it is paid off, and how much sooner: one tile, so the date and the time saved are not said twice. -->
      <div class="tile" [class.highlight]="r.savings.paymentsSaved > 0">
        <dt>Paid off</dt>
        <dd data-testid="payoff-date">{{ r.savings.acceleratedPayoffDate | date: 'MMM yyyy' }}</dd>
        @if (r.savings.paymentsSaved > 0) {
          <small><span data-testid="time-saved">{{ timeSaved() }}</span> sooner, instead of {{ r.savings.originalPayoffDate | date: 'MMM yyyy' }}</small>
        } @else if (r.accelerated.recasts.length > 0) {
          <small data-testid="same-payoff">Same date: a recast lowers the payment instead</small>
        }
      </div>
      @if (r.accelerated.mortgageInsuranceEndDate; as pmiEnd) {
        <div class="tile">
          <dt>PMI ends</dt>
          <dd data-testid="pmi-end">{{ pmiEnd | date: 'MMM yyyy' }}</dd>
          @if (r.baseline.mortgageInsuranceEndDate !== pmiEnd) {
            <small>instead of {{ r.baseline.mortgageInsuranceEndDate | date: 'MMM yyyy' }}</small>
          } @else {
            <small>{{ r.purchase.downPaymentPercent }}% down</small>
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

  /** The extra principal in the first payment and what that payment comes to, or null when nothing extra is paid. */
  readonly withExtra = computed(() => {
    const first = this.result().accelerated.payments[0];
    return first && first.extraPrincipal > 0 ? { amount: first.extraPrincipal, total: first.totalOutlay } : null;
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
