import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CalculationStore } from '../../core/state/calculation-store';
import { SaveCalculationComponent } from '../save-calculation/save-calculation.component';

/**
 * The layout every calculator page shares: the question the page answers and one line on how, then the form on the
 * left and the results on the right (results first on a phone), with the page's tabs (if any) and Save above them,
 * then what is wrong, then the results themselves.
 * Errors from the API, a notice when the form holds values that cannot be sent, and the placeholder before the
 * first result are all handled here, the same way on every page.
 *
 * Usage:
 *   <app-calculation-page [store]="store" heading="Should you refinance?" intro="…" [problems]="problems()" …>
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

  /** The question the page answers, its heading. */
  readonly heading = input.required<string>();

  /** One line under the heading on how the page answers it. */
  readonly intro = input.required<string>();

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
   * Brings the form into view and puts focus on it, so keyboard and screen-reader users land there too. Scrolls
   * smoothly, unless the visitor prefers reduced motion.
   */
  editInputs(formPanel: HTMLElement): void {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    formPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    formPanel.focus({ preventScroll: true });
  }
}
