import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { suggestRefinanceName } from '../../core/formatting/describe-inputs';
import { SavedInputs } from '../../core/models/saved-calculation.models';
import { SaveCalculationComponent } from '../../shared/save-calculation/save-calculation.component';
import { RefinanceFormComponent } from './refinance-form/refinance-form.component';
import { RefinanceResultsComponent } from './refinance-results/refinance-results.component';
import { RefinanceStore } from './refinance.store';

/**
 * Container for the refinance comparison: the form on the left, the results on the right (results
 * first on a phone). The store keeps the comparison, so it survives a trip to another page.
 */
@Component({
  selector: 'app-refinance-page',
  imports: [RefinanceFormComponent, RefinanceResultsComponent, SaveCalculationComponent],
  template: `
    <div class="layout">
      <aside class="panel form-panel" data-testid="refinance-form-panel">
        <app-refinance-form [initial]="startFrom" (analyze)="store.analyze($event)" />
      </aside>

      <section class="results" aria-label="Refinance comparison" aria-live="polite" [attr.aria-busy]="store.busy()"
               [class.updating]="store.busy()" data-testid="refinance-results">
        <div class="results-header">
          <h2>Should you refinance?</h2>
          <app-save-calculation [payload]="savePayload()" [suggestion]="suggestedName()" [linked]="store.saved()"
                                (saved)="store.linkTo($event)" />
        </div>
        @if (store.errors().length > 0) {
          <div class="alert" role="alert" data-testid="refinance-errors">
            <strong>We could not compare those loans.</strong>
            <ul>
              @for (message of store.errors(); track message) {
                <li>{{ message }}</li>
              }
            </ul>
          </div>
        }
        @if (store.result(); as result) {
          <app-refinance-results [result]="result" />
        } @else if (store.errors().length === 0) {
          <div class="panel placeholder">Comparing your loans…</div>
        }
      </section>
    </div>
  `,
  styleUrl: './refinance-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinancePageComponent {
  protected readonly store = inject(RefinanceStore);

  /** The comparison to resume, read once: the form owns its values from then on. */
  protected readonly startFrom = this.store.request();

  /** What Save stores: the comparison inputs, once there are any. */
  protected readonly savePayload = computed<SavedInputs | null>(() => {
    const refinance = this.store.request();
    return refinance ? { refinance } : null;
  });

  /** The name Save suggests, e.g. "Refinance 7% → 6%, 30 yr". */
  protected readonly suggestedName = computed(() => {
    const refinance = this.store.request();
    return refinance ? suggestRefinanceName(refinance) : '';
  });
}
