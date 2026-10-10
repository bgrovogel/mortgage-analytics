import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CalculationPageComponent } from '../../shared/calculation-page/calculation-page.component';
import { RefinanceFormComponent } from './refinance-form/refinance-form.component';
import { RefinanceResultsComponent } from './refinance-results/refinance-results.component';
import { RefinanceStore } from './refinance.store';

/** The refinance comparison: the form, and what refinancing would do. The store keeps it across pages. */
@Component({
  selector: 'app-refinance-page',
  imports: [CalculationPageComponent, RefinanceFormComponent, RefinanceResultsComponent],
  template: `
    <app-calculation-page [store]="store" heading="Should you refinance?" label="Refinance comparison" [problems]="problems()"
                          placeholder="Comparing your loans…" errorTitle="We could not compare those loans.">
      <app-refinance-form form [initial]="startFrom" [loan]="loan" (analyze)="store.send($event)" (problems)="problems.set($event)" />
      @if (store.result(); as result) {
        <app-refinance-results [result]="result" />
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

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);
}
