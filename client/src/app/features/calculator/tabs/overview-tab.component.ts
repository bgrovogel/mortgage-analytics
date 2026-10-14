import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { InViewDirective } from '../../../core/layout/in-view.directive';
import { paymentsMade } from '../../../core/loans/loan-progress';
import { BalanceChartComponent } from '../balance-chart/balance-chart.component';
import { CashToCloseComponent } from '../cash-to-close/cash-to-close.component';
import { CalculatorStore } from '../calculator.store';
import { PaymentBreakdownComponent } from '../payment-breakdown/payment-breakdown.component';
import { PointsSummaryComponent } from '../points-summary/points-summary.component';
import { ProgramSummaryComponent } from '../program-summary/program-summary.component';
import { RatePlanComponent } from '../rate-plan/rate-plan.component';
import { SavingsSummaryComponent } from '../savings-summary/savings-summary.component';
import { SellerOfferComponent } from '../seller-offer/seller-offer.component';

/** The answer at a glance: the headline numbers, where each month's payment goes, the payoff race, the cash to close, and the best use of the seller's money. */
@Component({
  selector: 'app-overview-tab',
  imports: [SavingsSummaryComponent, RatePlanComponent, ProgramSummaryComponent, PointsSummaryComponent, PaymentBreakdownComponent, BalanceChartComponent, CashToCloseComponent, SellerOfferComponent, InViewDirective],
  template: `
    <app-savings-summary [result]="result()" [current]="nextPayment()" (appInView)="headlineVisible($event)" aria-live="polite" data-testid="headline" />
    <app-program-summary [result]="result()" />
    <app-rate-plan [result]="result()" />
    <app-points-summary [result]="result()" />
    <div class="charts">
      <div class="panel"><app-payment-breakdown [schedule]="result().accelerated" [principalAndInterest]="result().buydown?.years?.[0]?.monthlyPayment ?? null" [current]="nextPayment()" [program]="result().program ?? null" /></div>
      <div class="panel"><app-balance-chart [result]="result()" /></div>
    </div>
    <!-- Cash to close is for a purchase still ahead; on a loan already being paid it closed long ago. -->
    @if (result().cashToClose && !nextPayment()) {
      <div class="panel"><app-cash-to-close [cash]="result().cashToClose!" [program]="result().program" /></div>
      @if (result().sellerOffer; as offer) {
        <div class="panel"><app-seller-offer [offer]="offer" /></div>
      }
    }
  `,
  styleUrl: './result-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  readonly result = computed(() => this.store.result()!);

  /**
   * On a loan already being paid (its first payment behind today), the payment due next, the one the form counts from;
   * null for a new loan, or one already paid off.
   */
  readonly nextPayment = computed(() => {
    const payments = this.result().baseline.payments;
    const made = paymentsMade(payments[0]?.dueDate, new Date());
    return made > 0 && made < payments.length ? payments[made] : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.store.headlineVisible.set(false));
  }

  /** Passes on whether the headline is on screen, so the page can hide its compact summary bar. */
  headlineVisible(visible: boolean): void {
    this.store.headlineVisible.set(visible);
  }
}
