import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatMonths } from '../../../core/formatting/duration';
import { AmortizationResponse } from '../../../core/models/amortization.models';

/** Headline numbers. These are stat tiles rather than a chart, because each one is a single value. */
@Component({
  selector: 'app-savings-summary',
  imports: [CurrencyPipe, DatePipe],
  template: `
    @let r = result();
    <dl class="tiles">
      <div class="tile">
        <dt>Monthly payment</dt>
        <dd data-testid="total-monthly-payment">{{ r.baseline.totalMonthlyPayment | currency }}</dd>
        <small>
          <span data-testid="monthly-payment">{{ r.baseline.monthlyPayment | currency }}</span> principal &amp; interest
          @if (r.baseline.monthlyHousingCosts.total > 0) {
            + {{ r.baseline.monthlyHousingCosts.total | currency }} taxes &amp; fees
          }
        </small>
      </div>
      <div class="tile highlight">
        <dt>Net savings</dt>
        <dd data-testid="net-savings">{{ r.savings.netSavings | currency: 'USD' : 'symbol' : '1.0-0' }}</dd>
        <small data-testid="savings-detail">{{ savingsDetail() }}</small>
      </div>
      <div class="tile highlight">
        <dt>Time saved</dt>
        <dd data-testid="time-saved">{{ timeSaved() }}</dd>
        <small>{{ r.accelerated.numberOfPayments }} of {{ r.baseline.numberOfPayments }} payments</small>
      </div>
      <div class="tile">
        <dt>Payoff date</dt>
        <dd data-testid="payoff-date">{{ r.savings.acceleratedPayoffDate | date: 'MMM yyyy' }}</dd>
        @if (r.savings.paymentsSaved > 0) {
          <small>instead of {{ r.savings.originalPayoffDate | date: 'MMM yyyy' }}</small>
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

  /** Payments saved, formatted as years and months. */
  readonly timeSaved = computed(() => formatMonths(this.result().savings.paymentsSaved));

  /** Where the net savings come from, e.g. "$79,801 interest + $6,531 PMI − $250 fees". */
  readonly savingsDetail = computed(() => {
    const s = this.result().savings;
    const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
    const parts = [`${money(s.interestSaved)} interest`];
    if (s.mortgageInsuranceSaved > 0) parts.push(`+ ${money(s.mortgageInsuranceSaved)} PMI`);
    if (s.recastFees > 0) parts.push(`− ${money(s.recastFees)} fees`);
    return parts.join(' ');
  });
}
