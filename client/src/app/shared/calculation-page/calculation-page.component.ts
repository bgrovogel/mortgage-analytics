import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { CalculationStore } from '../../core/state/calculation-store';
import { SaveCalculationComponent } from '../save-calculation/save-calculation.component';
import { ShareMenuComponent } from '../share-menu/share-menu.component';

/** The date a printout was made, as people write it: "Oct 14, 2026". */
const PRINTED = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

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
  imports: [SaveCalculationComponent, ShareMenuComponent],
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

  /** The answer in a line, once there is one, set large under the question: "$3,102 a month", "Yes, comfortably". */
  readonly lead = input<string | null>(null);

  /** The answer in a sentence, once there is one: it takes the intro's place under the heading. */
  readonly answer = input<string | null>(null);

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

  /** What a printout is for, e.g. "Mortgage Analytics · Calculator: $415,000 home, 9% down at 6.25% · Oct 14, 2026". */
  protected readonly printSummary = computed(() => {
    const store = this.store();
    const request = store.request();
    return request ? `Mortgage Analytics · ${store.pageName}: ${store.describe(request)} · ${PRINTED.format(new Date())}` : null;
  });

  /** Prints the page: the results, in the light theme, without the form or the page's controls (styles.scss). */
  print(): void {
    window.print();
  }

  /** On a phone the form is a sheet over the results: open while the visitor edits, out of the way otherwise. */
  protected readonly sheetOpen = signal(false);

  private readonly panel = viewChild<ElementRef<HTMLElement>>('formPanel');

  constructor() {
    // The page behind a sheet does not scroll while it is open.
    effect(() => document.body.classList.toggle('sheet-open', this.sheetOpen()));
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('sheet-open'));
    // Once the sheet is drawn (a hidden element cannot take focus), focus goes to it, for keyboard and screen-reader users.
    afterRenderEffect(() => {
      if (this.sheetOpen()) this.panel()?.nativeElement.focus({ preventScroll: true });
    });
  }

  /** Opens the form (a sheet on a phone); focus follows once it is drawn. */
  editInputs(): void {
    this.sheetOpen.set(true);
  }

  /** Closes the sheet, giving the results back. */
  protected closeSheet(): void {
    this.sheetOpen.set(false);
  }
}
