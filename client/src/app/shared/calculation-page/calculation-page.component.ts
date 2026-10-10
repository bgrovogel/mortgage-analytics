import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CalculationStore } from '../../core/state/calculation-store';
import { SaveCalculationComponent } from '../save-calculation/save-calculation.component';

/**
 * The layout every calculator page shares: the form on the left and the results on the right (results first on a
 * phone), a header with the page's title (or tabs) and Save, then what is wrong, then the results themselves.
 * Errors from the API, a notice when the form holds values that cannot be sent, and the placeholder before the
 * first result are all handled here, the same way on every page.
 *
 * Usage:
 *   <app-calculation-page [store]="store" heading="Should you refinance?" [problems]="problems()" …>
 *     <app-refinance-form form … />
 *     @if (store.result(); as result) { <app-refinance-results [result]="result" /> }
 *   </app-calculation-page>
 * Tabs instead of a title go in an element marked `tabs`.
 */
@Component({
  selector: 'app-calculation-page',
  imports: [SaveCalculationComponent],
  templateUrl: './calculation-page.component.html',
  styleUrl: './calculation-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculationPageComponent {
  /** The page's state. */
  readonly store = input.required<CalculationStore<unknown, unknown>>();

  /** The question the page answers, shown above the results. Leave empty when the page projects tabs instead. */
  readonly heading = input('');

  /** What the results region is called, for screen readers. */
  readonly label = input('Results');

  /** What the page says while its first result is on the way, e.g. "Comparing your loans…". */
  readonly placeholder = input.required<string>();

  /** The first line of an error from the API, e.g. "We could not compare those loans." */
  readonly errorTitle = input.required<string>();

  /** What is wrong with the form; while there is anything, the results are for the last valid inputs. */
  readonly problems = input<readonly string[]>([]);

  /** True to announce new results to screen readers as they arrive. Off for long, tabbed results. */
  readonly announce = input(true);

  /**
   * True to keep the form in view while the results scroll; it then scrolls on its own if it is taller than
   * the window. Off for a long form, which reads better scrolling with the page.
   */
  readonly stickyForm = input(true);
}
