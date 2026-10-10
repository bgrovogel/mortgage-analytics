import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { InViewDirective } from '../../../core/layout/in-view.directive';
import { BalanceChartComponent } from '../balance-chart/balance-chart.component';
import { CalculatorStore } from '../calculator.store';
import { PaymentBreakdownComponent } from '../payment-breakdown/payment-breakdown.component';
import { SavingsSummaryComponent } from '../savings-summary/savings-summary.component';

/** The answer at a glance: the headline numbers, where each month's payment goes, and the payoff race. */
@Component({
  selector: 'app-overview-tab',
  imports: [SavingsSummaryComponent, PaymentBreakdownComponent, BalanceChartComponent, InViewDirective],
  template: `
    <app-savings-summary [result]="result()" (appInView)="headlineVisible($event)" aria-live="polite" data-testid="headline" />
    <div class="charts">
      <div class="panel"><app-payment-breakdown [schedule]="result().accelerated" /></div>
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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.store.headlineVisible.set(false));
  }

  /** Passes on whether the headline is on screen, so the page can hide its compact summary bar. */
  headlineVisible(visible: boolean): void {
    this.store.headlineVisible.set(visible);
  }
}
