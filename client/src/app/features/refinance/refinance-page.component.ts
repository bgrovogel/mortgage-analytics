import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { monthOf, usd } from '../../core/formatting/format';
import { CalculationPageComponent } from '../../shared/calculation-page/calculation-page.component';
import { RefinanceFormComponent } from './refinance-form/refinance-form.component';
import { RefinanceResultsComponent } from './refinance-results/refinance-results.component';
import { RefinanceStore } from './refinance.store';
import { TPipe } from '../../core/i18n/t.pipe';
import { t } from '../../core/i18n/i18n';

/** The refinance comparison: the form, and what refinancing would do. The store keeps it across pages. */
@Component({
  selector: 'app-refinance-page',
  imports: [CalculationPageComponent, RefinanceFormComponent, RefinanceResultsComponent, TPipe],
  template: `
    <app-calculation-page [store]="store" [heading]="'Should you refinance?' | t" [label]="'Refinance comparison' | t"
                          [intro]="'Your loan today against a new one: the payment, the break-even, and the cost over both loans.' | t"
                          [problems]="problems()"
                          [placeholder]="'Comparing your loans…' | t" errorTitle="We could not compare those loans.">
      <app-refinance-form form [initial]="startFrom" [loan]="loan" [verdict]="verdict()" (analyze)="store.send($event)" (problems)="problems.set($event)" />
      @if (store.result(); as result) {
        <app-refinance-results [result]="result" [newRate]="store.request()?.newAnnualInterestRate ?? null" />
      }
    </app-calculation-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinancePageComponent {
  protected readonly store = inject(RefinanceStore);

  /** The comparison to resume, read once: the form owns its values from then on. */
  protected readonly startFrom = this.store.request();

  /** The loan, if another page has changed it since this one was last open. */
  protected readonly loan = this.store.loanToApply();

  /** The verdict in a line, for the form's second step: what refinancing does overall, and when it pays for itself. */
  protected readonly verdict = computed(() => {
    const r = this.store.result();
    if (!r) return null;
    const overall = r.lifetimeSavings >= 0 ? t('Saves {0}', [usd(r.lifetimeSavings)]) : t('Costs {0} more', [usd(-r.lifetimeSavings)]);
    return r.breakEvenDate ? t('{0} · break-even {1}', [overall, monthOf(r.breakEvenDate)]) : overall;
  });

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);
}
