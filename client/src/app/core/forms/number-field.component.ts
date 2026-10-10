import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import { FieldRule, problemWith } from './field-rules';
import { NumberInputDirective } from './number-input.directive';

/**
 * One number on a form: its label, the box ("$" before money, "%" after rates), and, once the user has touched
 * it, what is wrong with it, from the field's rule. Every number field in the app is one of these, so they all
 * look, behave and explain themselves the same way.
 *
 * Usage: `<app-number-field [control]="form.controls.homePrice" [rule]="rules.homePrice" testId="home-price" />`.
 * The label is the rule's, unless the element has content of its own (e.g. one with an <abbr>).
 */
@Component({
  selector: 'app-number-field',
  imports: [ReactiveFormsModule, NumberInputDirective],
  template: `
    <label class="field">
      <span><ng-content>{{ label() || rule().label }}</ng-content></span>
      <span class="affix" [attr.data-prefix]="rule().unit === '$' ? '$' : null" [attr.data-suffix]="rule().unit === '%' ? '%' : null">
        <input appNumber [decimals]="decimals()" [formControl]="control()" [placeholder]="placeholder()"
               [attr.aria-invalid]="showError()" [attr.data-testid]="testId()" />
      </span>
      @if (showError()) {
        <small class="error" [attr.data-testid]="'error-' + testId()">{{ message() }}</small>
      }
    </label>
  `,
  styleUrl: './number-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberFieldComponent {
  /** The form control holding the number (null while the box is blank). */
  readonly control = input.required<FormControl<number> | FormControl<number | null>>();

  /** What the number means and may hold. */
  readonly rule = input.required<FieldRule>();

  /** The box's test id; its error's is `error-` and the same id. */
  readonly testId = input.required<string>();

  /** A label to show instead of the rule's (which messages still use). */
  readonly label = input('');

  /** Shown in an empty box, e.g. "No end". */
  readonly placeholder = input('');

  protected readonly decimals = computed(() => this.rule().decimals ?? (this.rule().whole ? 0 : 2));

  constructor() {
    // The control changes outside this component (typing, a value set from code, the form marked as touched),
    // so check this view whenever it reports anything.
    const changes = inject(ChangeDetectorRef);
    toObservable(this.control)
      .pipe(
        switchMap((control) => control.events),
        takeUntilDestroyed(),
      )
      .subscribe(() => changes.markForCheck());
  }

  /** True when the field should show its error: invalid and already interacted with. */
  showError(): boolean {
    const control = this.control();
    return control.invalid && (control.touched || control.dirty);
  }

  /** What is wrong, in plain words. */
  protected message(): string {
    return problemWith(this.rule(), this.control()) ?? '';
  }
}
