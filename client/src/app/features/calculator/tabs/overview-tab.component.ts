import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { InViewDirective } from '../../../core/layout/in-view.directive';
import { nextPayment } from '../answer-sentence';
import { BalanceChartComponent } from '../balance-chart/balance-chart.component';
import { CalculatorStore } from '../calculator.store';
import { PaymentBreakdownComponent } from '../payment-breakdown/payment-breakdown.component';
import { PointsSummaryComponent } from '../points-summary/points-summary.component';
import { ProgramSummaryComponent } from '../program-summary/program-summary.component';
import { RatePlanComponent } from '../rate-plan/rate-plan.component';
import { RateWhatIfComponent } from '../rate-what-if/rate-what-if.component';
import { SavingsSummaryComponent } from '../savings-summary/savings-summary.component';

/**
 * The answer at a glance: the answer tiles (the monthly payment, the cash to close, whether you can afford it, what
 * paying extra saves), then where each month's payment goes and the payoff race. The details behind the cash to close
 * and the affordability have tabs of their own.
 */
@Component({
  selector: 'app-overview-tab',
  imports: [SavingsSummaryComponent, RatePlanComponent, ProgramSummaryComponent, PointsSummaryComponent, RateWhatIfComponent, PaymentBreakdownComponent, BalanceChartComponent, InViewDirective],
  template: `
    <app-savings-summary [result]="result()" [current]="nextPayment()" (appInView)="headlineVisible($event)" aria-live="polite" data-testid="headline" />
    <app-program-summary [result]="result()" />
    <app-rate-plan [result]="result()" />
    <app-points-summary [result]="result()" />
    <app-rate-what-if [result]="result()" />
    <div class="charts">
      <div class="panel"><app-payment-breakdown [schedule]="result().accelerated" [principalAndInterest]="result().buydown?.years?.[0]?.monthlyPayment ?? null" [current]="nextPayment()" [program]="result().program ?? null" /></div>
      <div class="panel"><app-balance-chart [result]="result()" /></div>
    </div>
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
  readonly nextPayment = computed(() => nextPayment(this.result()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.store.headlineVisible.set(false));
  }

  /** Passes on whether the headline is on screen, so the page can hide its compact summary bar. */
  headlineVisible(visible: boolean): void {
    this.store.headlineVisible.set(visible);
  }
}
