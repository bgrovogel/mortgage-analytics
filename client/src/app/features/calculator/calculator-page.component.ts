import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CalculatorStore } from './calculator.store';
import { LoanFormComponent } from './loan-form/loan-form.component';
import { suggestName } from '../../core/formatting/describe-inputs';
import { SavedInputs } from '../../core/models/saved-calculation.models';
import { SaveCalculationComponent } from '../../shared/save-calculation/save-calculation.component';

/** The result tabs, each its own URL so it can be bookmarked, shared and reached with the back button. */
const RESULT_TABS = [
  { path: 'overview', label: 'Overview' },
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
  imports: [CurrencyPipe, LoanFormComponent, RouterLink, RouterLinkActive, RouterOutlet, SaveCalculationComponent],
  templateUrl: './calculator-page.component.html',
  styleUrl: './calculator-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculatorPageComponent {
  protected readonly store = inject(CalculatorStore);
  protected readonly tabs = RESULT_TABS;

  /** The calculation to resume, read once: the form owns its values from then on. */
  protected readonly startFrom = this.store.request();

  /** What Save stores: the calculator inputs, once there are any. */
  protected readonly savePayload = computed<SavedInputs | null>(() => {
    const inputs = this.store.request();
    return inputs ? { inputs } : null;
  });

  /** The name Save suggests for a new calculation. */
  protected readonly suggestedName = computed(() => {
    const inputs = this.store.request();
    return inputs ? suggestName(inputs) : '';
  });
}
