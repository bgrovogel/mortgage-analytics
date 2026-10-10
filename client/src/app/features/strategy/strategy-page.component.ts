import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StrategyFormComponent } from './strategy-form/strategy-form.component';
import { StrategyResultsComponent } from './strategy-results/strategy-results.component';
import { StrategyStore } from './strategy.store';

/**
 * Container for the pay-off-or-invest comparison: the form on the left, the results on the right (results
 * first on a phone). The store keeps the comparison, so it survives a trip to another page.
 */
@Component({
  selector: 'app-strategy-page',
  imports: [StrategyFormComponent, StrategyResultsComponent],
  template: `
    <div class="layout">
      <aside class="panel form-panel" data-testid="strategy-form-panel">
        <app-strategy-form [initial]="startFrom" (compare)="store.compare($event)" />
      </aside>

      <section class="results" aria-label="Strategy comparison" aria-live="polite" [attr.aria-busy]="store.busy()"
               [class.updating]="store.busy()" data-testid="strategy-results">
        <div class="results-header">
          <h2>Pay off the mortgage, or invest?</h2>
        </div>
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
}
