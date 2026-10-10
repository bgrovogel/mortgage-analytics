import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, map, startWith, switchMap } from 'rxjs';
import { toErrorMessages } from '../../core/errors/problem-details';
import { describeInputs } from '../../core/formatting/describe-inputs';
import { SavedCalculation } from '../../core/models/saved-calculation.models';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { CalculatorStore } from '../calculator/calculator.store';

/** How long to wait after the last keystroke before searching. */
export const SEARCH_DELAY_MS = 300;

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Every saved calculation, newest first, searchable by name. Each can be opened in the calculator,
 * renamed in place, or deleted after a confirmation.
 */
@Component({
  selector: 'app-history-page',
  imports: [RouterLink],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPageComponent {
  private readonly api = inject(SavedCalculationsApiService);
  private readonly store = inject(CalculatorStore);
  private readonly router = inject(Router);
  private readonly searches = new Subject<string>();

  /** The calculations shown: the current search's results. */
  readonly calculations = signal<SavedCalculation[]>([]);

  /** False until the first list arrives (or fails), so the empty message does not flash. */
  readonly loaded = signal(false);

  /** The search the list currently reflects. */
  readonly searched = signal('');

  /** What went wrong with the last action, if anything. */
  readonly error = signal<string | null>(null);

  /** The calculation being renamed, and the name typed so far. */
  readonly renaming = signal<{ id: string; name: string } | null>(null);

  /** The calculation waiting for a delete confirmation. */
  readonly confirmingDelete = signal<string | null>(null);

  protected readonly describe = describeInputs;

  constructor() {
    // The first list loads at once; later searches wait for a pause in typing. switchMap drops the
    // results of a search that a newer one has replaced, and errors are caught per search.
    this.searches
      .pipe(
        debounceTime(SEARCH_DELAY_MS),
        startWith(''),
        switchMap((term) =>
          this.api.list(term).pipe(
            map((list) => ({ term: term.trim(), list })),
            catchError((error: unknown) => {
              this.fail(error);
              this.loaded.set(true);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ term, list }) => {
        this.calculations.set(list);
        this.searched.set(term);
        this.error.set(null);
        this.loaded.set(true);
      });
  }

  /** Queues a search for names containing `text`. */
  onSearch(text: string): void {
    this.searches.next(text);
  }

  /** "Saved Oct 9, 2026", or "Updated …" once it has been changed. */
  when(calculation: SavedCalculation): string {
    return calculation.updatedAt === calculation.createdAt
      ? `Saved ${day.format(new Date(calculation.createdAt))}`
      : `Updated ${day.format(new Date(calculation.updatedAt))}`;
  }

  /** Loads the calculation into the calculator and goes there. */
  open(calculation: SavedCalculation): void {
    this.store.open(calculation);
    void this.router.navigate(['/calculator', 'overview']);
  }

  /** Starts renaming, with the current name to edit. */
  startRename(calculation: SavedCalculation): void {
    this.confirmingDelete.set(null);
    this.renaming.set({ id: calculation.id, name: calculation.name });
  }

  /** Asks to confirm deleting a calculation. */
  askToDelete(calculation: SavedCalculation): void {
    this.renaming.set(null);
    this.confirmingDelete.set(calculation.id);
  }

  /** Saves the new name; the inputs are sent back unchanged. */
  saveRename(calculation: SavedCalculation): void {
    const name = this.renaming()?.name.trim();
    if (!name) {
      this.error.set('Give the calculation a name.');
      return;
    }

    this.api.update(calculation.id, name, calculation.inputs).subscribe({
      next: (updated) => {
        this.calculations.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        if (this.store.saved()?.id === updated.id) this.store.linkTo(updated);
        this.renaming.set(null);
        this.error.set(null);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Deletes a calculation once the user has confirmed. */
  remove(calculation: SavedCalculation): void {
    this.api.delete(calculation.id).subscribe({
      next: () => {
        this.calculations.update((list) => list.filter((c) => c.id !== calculation.id));
        if (this.store.saved()?.id === calculation.id) this.store.saved.set(null);
        this.confirmingDelete.set(null);
        this.error.set(null);
      },
      error: (error: unknown) => {
        this.confirmingDelete.set(null);
        this.fail(error);
      },
    });
  }

  private fail(error: unknown): void {
    this.error.set(toErrorMessages(error).join(' '));
  }
}
