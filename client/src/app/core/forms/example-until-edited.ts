import { DestroyRef, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { take } from 'rxjs';

/**
 * Whether a form still shows its worked example: true from the start (when `startsAsExample`) until the visitor's
 * first edit, then false for good. A form that started from a saved or shared loan never shows the example.
 * Call it once the form has been filled in, so filling it in does not count as an edit.
 */
export function exampleUntilEdited(form: AbstractControl, startsAsExample: boolean, destroyRef: DestroyRef): Signal<boolean> {
  const example = signal(startsAsExample);
  if (startsAsExample) {
    form.valueChanges.pipe(take(1), takeUntilDestroyed(destroyRef)).subscribe(() => example.set(false));
  }
  return example.asReadonly();
}
