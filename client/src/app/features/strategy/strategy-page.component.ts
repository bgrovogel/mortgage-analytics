import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { suggestStrategyName } from '../../core/formatting/describe-inputs';
import { SavedInputs } from '../../core/models/saved-calculation.models';
import { SaveCalculationComponent } from '../../shared/save-calculation/save-calculation.component';
import { StrategyFormComponent } from './strategy-form/strategy-form.component';
import { StrategyResultsComponent } from './strategy-results/strategy-results.component';
import { StrategyStore } from './strategy.store';

/**
 * Container for the pay-off-or-invest comparison: the form on the left, the results on the right (results
 * first on a phone). The store keeps the comparison, so it survives a trip to another page.
 */
@Component({
  selector: 'app-strategy-page',
  imports: [StrategyFormComponent, StrategyResultsComponent, SaveCalculationComponent],
  template: `
    <div class="layout">
      <aside class="panel form-panel" data-testid="strategy-form-panel">
        <app-strategy-form [initial]="startFrom" (compare)="store.compare($event)" (problems)="problems.set($event)" />
      </aside>

      <section class="results" aria-label="Strategy comparison" aria-live="polite" [attr.aria-busy]="store.busy()"
               [class.updating]="store.busy()" data-testid="strategy-results">
        <div class="results-header">
          <h2>Pay off the mortgage, or invest?</h2>
          <app-save-calculation [payload]="savePayload()" [suggestion]="suggestedName()" [linked]="store.saved()"
                                (saved)="store.linkTo($event)" />
        </div>
        @if (problems().length > 0 && store.result()) {
          <div class="alert stale" role="status" data-testid="strategy-stale">
            <strong>These results are for your last valid inputs.</strong> Fix {{ problems().length === 1 ? 'this' : 'these' }} to update them:
            <ul>
              @for (problem of problems(); track problem) {
                <li>{{ problem }}</li>
              }
            </ul>
          </div>
        }
        @if (store.errors().length > 0) {
          <div class="alert" role="alert" data-testid="strategy-errors">
            <strong>We could not compare those strategies.</strong>
            <ul>
              @for (message of store.errors(); track message) {
                <li>{{ message }}</li>
              }
            </ul>
          </div>
        }
        @if (store.result(); as result) {
          <app-strategy-results [result]="result" />
        } @else if (store.errors().length === 0) {
          <div class="panel placeholder">Playing out 30 years…</div>
        }
      </section>
    </div>
  `,
  styleUrl: './strategy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategyPageComponent {
  protected readonly store = inject(StrategyStore);

  /** The comparison to resume, read once: the form owns its values from then on. */
  protected readonly startFrom = this.store.request();

  /** What is wrong with the form, if anything; while it is not empty the results are for the last valid inputs. */
  protected readonly problems = signal<string[]>([]);

  /** What Save stores: the comparison inputs, once there are any. */
  protected readonly savePayload = computed<SavedInputs | null>(() => {
    const strategy = this.store.request();
    return strategy ? { strategy } : null;
  });

  /** The name Save suggests, e.g. "Pay off or invest: $1,000/mo, 6.5% mortgage". */
  protected readonly suggestedName = computed(() => {
    const strategy = this.store.request();
    return strategy ? suggestStrategyName(strategy) : '';
  });
}
