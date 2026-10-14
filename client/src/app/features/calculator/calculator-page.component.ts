import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AmortizationRequest } from '../../core/models/amortization.models';
import { CalculatorStore } from './calculator.store';
import { ComparisonStore } from './comparison.store';
import { LoanFormComponent } from './loan-form/loan-form.component';
import { CalculationPageComponent } from '../../shared/calculation-page/calculation-page.component';
import { AmortizationResponse } from '../../core/models/amortization.models';

/** The result tabs, each its own URL so it can be bookmarked, shared and reached with the back button. */
const RESULT_TABS = [
  { path: 'overview', label: 'Overview' },
  { path: 'projection', label: 'Projection' },
  { path: 'schedule', label: 'Schedule' },
  { path: 'compare', label: 'Compare' },
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
  protected readonly comparison = inject(ComparisonStore);
  protected readonly tabs = RESULT_TABS;

  private readonly router = inject(Router);
  private readonly url = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)), {
    initialValue: this.router.url,
  });

  /** True on the Compare tab, where a second home sits beside the one in the form. */
  protected readonly comparing = computed(() => this.url().split(/[?#]/)[0].endsWith('/compare'));

  /** Which home the switch above the form has chosen to edit. Only the Compare tab has a Home B. */
  protected readonly house = signal<'A' | 'B'>('A');
  protected readonly editing = computed(() => (this.comparing() ? this.house() : 'A'));

  /** The state Save, errors and the placeholder belong to: the comparison on its tab, the calculator elsewhere. */
  protected readonly pageStore = computed(() => (this.comparing() ? this.comparison : this.store));

  /**
   * Where Home A's form starts: the calculation to resume when the page opens, then (after switching to Home B and
   * back) what it was showing. Read once by each new form, which owns its values from then on.
   */
  protected readonly startFrom = signal(this.store.request());

  /** The loan another page changed since this one was last open: for the first form only, which applies it. */
  protected readonly loan = signal(this.store.loanToApply());

  constructor() {
    // On the Compare tab, Home A is the calculator's loan: whenever that changes (or the tab opens), compare again.
    // Home B starts as a copy of Home A, to change whatever differs.
    effect(() => {
      if (!this.comparing()) return;
      const first = this.store.request();
      const current = untracked(this.comparison.request);
      if (first && current?.first !== first) this.comparison.send({ first, second: current?.second ?? first });
    });
  }

  /** Switches the form between the two homes. Each form is made anew from its store, so the page has one form. */
  protected edit(house: 'A' | 'B'): void {
    if (house === this.house()) return;
    this.startFrom.set(this.store.request());
    this.loan.set(null);
    this.problems.set([]);
    this.house.set(house);
  }

  /** Home B changed: compare it with Home A. */
  protected sendSecond(second: AmortizationRequest): void {
    const first = this.store.request();
    if (first) this.comparison.send({ first, second });
  }

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);

  /** The first payment due, with housing costs: with a buydown, year 1's reduced payment, as the headline tile shows. */
  protected firstMonthlyPayment(r: AmortizationResponse): number {
    const firstYear = r.buydown?.years[0];
    return firstYear ? firstYear.monthlyPayment + r.baseline.monthlyHousingCosts.total : r.baseline.totalMonthlyPayment;
  }
}
