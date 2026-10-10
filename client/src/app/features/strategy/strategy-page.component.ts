import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CalculationPageComponent } from '../../shared/calculation-page/calculation-page.component';
import { StrategyFormComponent } from './strategy-form/strategy-form.component';
import { StrategyResultsComponent } from './strategy-results/strategy-results.component';
import { StrategyStore } from './strategy.store';

/** The pay-off-or-invest comparison: the household, and how the three strategies play out. The store keeps it across pages. */
@Component({
  selector: 'app-strategy-page',
  imports: [CalculationPageComponent, StrategyFormComponent, StrategyResultsComponent],
  template: `
    <app-calculation-page [store]="store" heading="Pay off the mortgage, or invest?" label="Strategy comparison"
                          [problems]="problems()" [stickyForm]="false" placeholder="Playing out 30 years…"
                          errorTitle="We could not compare those strategies.">
      <app-strategy-form form [initial]="startFrom" (compare)="store.send($event)" (problems)="problems.set($event)" />
      @if (store.result(); as result) {
        <app-strategy-results [result]="result" />
      }
    </app-calculation-page>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategyPageComponent {
  protected readonly store = inject(StrategyStore);

  /** The comparison to resume, read once: the form owns its values from then on. */
  protected readonly startFrom = this.store.request();

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);
}
