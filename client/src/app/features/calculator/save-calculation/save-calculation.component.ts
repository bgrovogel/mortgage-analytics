import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { toErrorMessages } from '../../../core/errors/problem-details';
import { suggestName } from '../../../core/formatting/describe-inputs';
import { SavedCalculation } from '../../../core/models/saved-calculation.models';
import { SavedCalculationsApiService } from '../../../core/services/saved-calculations-api.service';
import { CalculatorStore } from '../calculator.store';

/**
 * Saves the current calculation under a name. A new one gets a suggested name built from the loan.
 * When the calculation came from history (or was already saved), it can also update that one in place.
 */
@Component({
  selector: 'app-save-calculation',
  imports: [RouterLink],
  templateUrl: './save-calculation.component.html',
  styleUrl: './save-calculation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveCalculationComponent {
  protected readonly store = inject(CalculatorStore);
  private readonly api = inject(SavedCalculationsApiService);

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
    const request = this.store.request();
    if (!request) return;
    this.name.set(this.store.saved()?.name ?? suggestName(request));
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
    this.submit('Saved as', (name, inputs) => this.api.save(name, inputs));
  }

  /** Replaces the linked saved calculation with the current inputs (and name). */
  update(id: string): void {
    this.submit('Updated', (name, inputs) => this.api.update(id, name, inputs));
  }

  private submit(verb: string, send: (name: string, inputs: SavedCalculation['inputs']) => Observable<SavedCalculation>): void {
    const name = this.name().trim();
    const inputs = this.store.request();
    if (!name) {
      this.error.set('Give the calculation a name.');
      return;
    }
    if (!inputs || this.saving()) return;

    this.saving.set(true);
    send(name, inputs).subscribe({
      next: (saved) => {
        this.store.linkTo(saved);
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
