import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CalculatorStore } from '../calculator.store';
import { CostProjectionComponent } from '../cost-projection/cost-projection.component';
import { CostTotalsComponent } from '../cost-projection/cost-totals.component';

/**
 * The long view, year by year: the quick numbers for a chosen year first (that year, through it, the whole loan),
 * then what the home costs to own, what it is worth against what is taxed, and how much of it is yours. A click on
 * the costs chart chooses the year the numbers are for.
 */
@Component({
  selector: 'app-projection-tab',
  imports: [CostProjectionComponent, CostTotalsComponent],
  template: `
    <div class="panel"><app-cost-totals [projection]="result().projection" [(year)]="year" /></div>
    <div class="panel"><app-cost-projection [result]="result()" view="costs" (yearPicked)="year.set($event)" /></div>
    <div class="panel"><app-cost-projection [result]="result()" view="value" /></div>
    <div class="panel"><app-cost-projection [result]="result()" view="equity" /></div>
  `,
  styleUrl: './result-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectionTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  readonly result = computed(() => this.store.result()!);

  /** The year the quick numbers are for; null shows where the loan is now. */
  protected readonly year = signal<number | null>(null);
}
