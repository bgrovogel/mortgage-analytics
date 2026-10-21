import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { nextPayment, viewAnswer } from './answer-sentence';
import { BuyTabsComponent, currentBuyView } from './buy-tabs/buy-tabs.component';
import { CalculatorStore } from './calculator.store';
import { FirstVisitHintsComponent } from './first-visit/first-visit-hints.component';
import { LoanFormComponent } from './loan-form/loan-form.component';
import { RentalSettingsComponent } from './rental-settings/rental-settings.component';
import { RentSettingsComponent } from './rent-settings/rent-settings.component';
import { SaleSettingsComponent } from './sale-settings/sale-settings.component';
import { CalculationPageComponent } from '../../shared/calculation-page/calculation-page.component';
import { AmortizationResponse } from '../../core/models/amortization.models';

/**
 * The calculator: the form on the left, the routed result tabs on the right. The page wires the form
 * to the store; the tabs read results from the store. On a phone the results come first, and a
 * compact summary bar keeps the key numbers in view whenever the headline is off screen.
 */
@Component({
  selector: 'app-calculator-page',
  imports: [BuyTabsComponent, CalculationPageComponent, CurrencyPipe, FirstVisitHintsComponent, LoanFormComponent, RentalSettingsComponent, RentSettingsComponent, RouterOutlet, SaleSettingsComponent],
  templateUrl: './calculator-page.component.html',
  styleUrl: './calculator-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculatorPageComponent {
  protected readonly store = inject(CalculatorStore);

  /** The calculation to resume when the page opens, read once: the form owns its values from then on. */
  protected readonly startFrom = this.store.request();

  /** The loan another page changed since this one was last open, which the form applies. */
  protected readonly loan = this.store.loanToApply();

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);

  protected readonly view = currentBuyView();

  /** The question and the answer for the view open: what it costs, whether it can be afforded, rent against buy. */
  protected readonly answered = computed(() => {
    const result = this.store.result();
    return result ? viewAnswer(result, this.view(), nextPayment(result), this.store.affordStart()) : null;
  });

  /**
   * What the pinned summary says beside the payment on the views that ask something other than the cost: the answer
   * (Yes, comfortably; Buy, if you stay 4 years or more). Null on the cost views, which say what paying extra saves.
   */
  protected readonly questionLead = computed(() =>
    this.view() === 'affordability' || this.view() === 'rent-or-buy' ? (this.answered()?.lead ?? null) : null);

  /** The page's question: the view's once there is a result, the first view's until then. */
  protected readonly heading = computed(() => this.answered()?.heading ?? 'What will this home cost?');

  /** The first payment due, with housing costs: with a buydown, year 1's reduced payment, as the headline tile shows. */
  protected firstMonthlyPayment(r: AmortizationResponse): number {
    const firstYear = r.buydown?.years[0];
    return firstYear ? firstYear.monthlyPayment + r.baseline.monthlyHousingCosts.total : r.baseline.totalMonthlyPayment;
  }
}
