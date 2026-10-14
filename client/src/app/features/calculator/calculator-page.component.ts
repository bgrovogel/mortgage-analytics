import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CalculatorStore } from './calculator.store';
import { LoanFormComponent } from './loan-form/loan-form.component';
import { CalculationPageComponent } from '../../shared/calculation-page/calculation-page.component';
import { AmortizationResponse } from '../../core/models/amortization.models';

/** The result tabs, each its own URL so it can be bookmarked, shared and reached with the back button. */
const RESULT_TABS = [
  { path: 'overview', label: 'Overview' },
  { path: 'affordability', label: 'Affordability' },
  { path: 'closing', label: 'Closing' },
  { path: 'rent-or-buy', label: 'Rent or buy' },
  { path: 'projection', label: 'Projection' },
  { path: 'schedule', label: 'Schedule' },
] as const;

/**
 * The calculator: the form on the left, the routed result tabs on the right. The page wires the form
 * to the store; the tabs read results from the store. On a phone the results come first, and a
 * compact summary bar keeps the key numbers in view whenever the headline is off screen.
 */
@Component({
  selector: 'app-calculator-page',
  imports: [CalculationPageComponent, CurrencyPipe, LoanFormComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './calculator-page.component.html',
  styleUrl: './calculator-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculatorPageComponent {
  protected readonly store = inject(CalculatorStore);
  protected readonly tabs = RESULT_TABS;

  /** The calculation to resume when the page opens, read once: the form owns its values from then on. */
  protected readonly startFrom = this.store.request();

  /** The loan another page changed since this one was last open, which the form applies. */
  protected readonly loan = this.store.loanToApply();

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);

  /** The first payment due, with housing costs: with a buydown, year 1's reduced payment, as the headline tile shows. */
  protected firstMonthlyPayment(r: AmortizationResponse): number {
    const firstYear = r.buydown?.years[0];
    return firstYear ? firstYear.monthlyPayment + r.baseline.monthlyHousingCosts.total : r.baseline.totalMonthlyPayment;
  }
}
