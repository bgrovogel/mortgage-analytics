import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { AffordabilityComponent } from '../affordability/affordability.component';
import { CalculatorStore } from '../calculator.store';

/**
 * Can you afford it: the home against the household's income and debts, as a lender measures it. Until an income is
 * given, it says what the tab would show, with a button to the field that fills it.
 */
@Component({
  selector: 'app-affordability-tab',
  imports: [AffordabilityComponent],
  template: `
    @if (result().affordability; as affordability) {
      <div class="panel">
        <app-affordability [affordability]="affordability" [program]="result().program?.type ?? 'Conventional'"
                           [downPaymentPercent]="result().purchase.downPaymentPercent" />
      </div>
    } @else {
      <div class="panel empty" data-testid="affordability-empty">
        <h2>Can you afford it?</h2>
        <p>
          Add your household's income and your other monthly debts, and this tab measures the home the way a lender
          would: the share of your income it takes, and the most you could pay.
        </p>
        <button type="button" (click)="addIncome()" data-testid="add-income">Add your income</button>
      </div>
    }
  `,
  styleUrl: './result-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffordabilityTabComponent {
  private readonly store = inject(CalculatorStore);
  private readonly navigator = inject(FormNavigator);

  /** The page only shows the tabs once there is a result. */
  protected readonly result = computed(() => this.store.result()!);

  /** Opens the form's income section with the cursor in the income field. */
  protected addIncome(): void {
    this.navigator.open('income', 'annual-income');
  }
}
