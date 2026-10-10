import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { toErrorMessages } from '../../core/errors/problem-details';
import { SavedCalculation, SavedInputs } from '../../core/models/saved-calculation.models';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';

/**
 * Saves what a page is showing (calculator inputs or a refinance comparison) under a name. A new save
 * starts from a suggested name; when the page is linked to a saved item (it came from History, or was
 * saved already) it can also update that item in place. The page owns the state: it passes in what to
 * save and what it is linked to, and records the link when `saved` fires.
 */
@Component({
  selector: 'app-save-calculation',
  imports: [RouterLink],
  templateUrl: './save-calculation.component.html',
  styleUrl: './save-calculation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveCalculationComponent {
  private readonly api = inject(SavedCalculationsApiService);

  /** What to save, or null while there is nothing to save yet. */
  readonly payload = input<SavedInputs | null>(null);

  /** The name a new save starts from, e.g. "$375,000 home, 20% down at 6.5%". */
  readonly suggestion = input('');

  /** The saved item the page is showing, if any, so it can be updated in place. */
  readonly linked = input<Pick<SavedCalculation, 'id' | 'name'> | null>(null);

  /** Emits what was saved or updated, so the page can link itself to it. */
  readonly saved = output<SavedCalculation>();

  /** Whether the name form is showing. */
  readonly editing = signal(false);

  /** The name being typed. */
  readonly name = signal('');

  /** What went wrong with the last attempt, if anything. */
  readonly error = signal<string | null>(null);

  /** What the last successful save did, e.g. { verb: 'Saved as', name: 'Oak St' }. */
  readonly status = signal<{ verb: string; name: string } | null>(null);

  /** True while a save is on its way, so it cannot be sent twice. */
  readonly saving = signal(false);

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    // Put the caret in the name box as soon as it appears, ready to type over the suggestion.
    effect(() => {
      const box = this.nameInput()?.nativeElement;
      box?.focus();
      box?.select();
    });
  }

  /** Opens the form with the linked calculation's name, or a suggested one. */
  openForm(): void {
    if (!this.payload()) return;
    this.name.set(this.linked()?.name ?? this.suggestion());
    this.error.set(null);
    this.status.set(null);
    this.editing.set(true);
  }

  /** Closes the form without saving. */
  close(): void {
    this.editing.set(false);
  }

  /** Saves as a new calculation. */
  saveNew(): void {
    this.submit('Saved as', (name, payload) => this.api.save(name, payload));
  }

  /** Replaces the linked saved calculation with the current inputs (and name). */
  update(id: string): void {
    this.submit('Updated', (name, payload) => this.api.update(id, name, payload));
  }

  private submit(verb: string, send: (name: string, payload: SavedInputs) => Observable<SavedCalculation>): void {
    const name = this.name().trim();
    const payload = this.payload();
    if (!name) {
      this.error.set('Give the calculation a name.');
      return;
    }
    if (!payload || this.saving()) return;

    this.saving.set(true);
    send(name, payload).subscribe({
      next: (saved) => {
        this.saved.emit(saved);
        this.status.set({ verb, name: saved.name });
        this.editing.set(false);
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.error.set(toErrorMessages(error).join(' '));
        this.saving.set(false);
      },
    });
  }
}
