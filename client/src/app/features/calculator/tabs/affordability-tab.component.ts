import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { usd } from '../../../core/formatting/format';
import { BudgetAnswer } from '../../../core/models/amortization.models';
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
    <div class="start" role="radiogroup" aria-label="Start from" data-testid="afford-start">
      <label><input type="radio" name="afford-start" value="home" [checked]="store.affordStart() === 'home'" (change)="store.affordStart.set('home')" data-testid="start-home" /> A home in mind</label>
      <label><input type="radio" name="afford-start" value="budget" [checked]="store.affordStart() === 'budget'" (change)="store.affordStart.set('budget')" data-testid="start-budget" /> My budget</label>
    </div>
    @if (result().budget; as budget) {
      <div class="panel budget-answer">
        <p data-testid="budget-answer">{{ budgetSentence(budget) }}</p>
        @if (budget.maxHomePrice > 0) {
          <button type="button" (click)="priceAt(budget.maxHomePrice)" data-testid="price-at-budget">Price a home at {{ money(budget.maxHomePrice) }}</button>
        }
      </div>
    }
    @if (result().affordability; as affordability) {
      <div class="panel flat">
        <app-affordability [affordability]="affordability" [program]="result().program?.type ?? 'Conventional'"
                           [downPaymentPercent]="result().purchase.downPaymentPercent" [homePrice]="result().purchase.homePrice" />
        @if (affordability.comfortable.maxHomePrice > 0) {
          <p class="carry">
            <button type="button" (click)="priceAt(affordability.comfortable.maxHomePrice)" data-testid="price-at-comfortable">Price a home at {{ money(affordability.comfortable.maxHomePrice) }}</button>
            <span>Fills the home price in the form, keeping your down payment share, to see what it would really cost.</span>
          </p>
        }
      </div>
    } @else {
      <div class="panel empty" data-testid="affordability-empty">
        <!-- The answer above already asks the question and says what is needed; this says what the tab will show. -->
        <p>This tab measures the home the way a lender would: the share of your income it takes, and the most you could pay.</p>
        <button type="button" (click)="addIncome()" data-testid="add-income">Add your income</button>
      </div>
    }
  `,
  styleUrl: './result-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffordabilityTabComponent {
  protected readonly store = inject(CalculatorStore);
  private readonly navigator = inject(FormNavigator);

  /** The page only shows the tabs once there is a result. */
  protected readonly result = computed(() => this.store.result()!);

  protected readonly money = usd;

  /** Prices the home in the form at an amount: what the buyer could afford, carried over to see what it costs. */
  protected priceAt(price: number): void {
    this.navigator.priceAt(price);
  }

  /** What the monthly budget reaches, in a sentence. */
  protected budgetSentence(budget: BudgetAnswer): string {
    const payment = `A payment of ${usd(budget.monthlyBudget)} a month`;
    return budget.maxHomePrice > 0
      ? `${payment}, with taxes and insurance, reaches a home up to ${usd(budget.maxHomePrice)}, with ${usd(budget.downPayment)} down.`
      : `${payment} does not reach a home: the taxes and insurance alone come to more.`;
  }

  /** Opens the form's income section with the cursor in the income field. */
  protected addIncome(): void {
    this.navigator.open('income', 'annual-income');
  }
}
