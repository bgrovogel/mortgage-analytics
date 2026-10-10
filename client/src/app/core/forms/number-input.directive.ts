import { Directive, ElementRef, forwardRef, inject, input } from '@angular/core';
import { AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator } from '@angular/forms';

/**
 * A number box that reads like money: "375,000" while you look at it, "375000" while you edit it.
 *
 * It is a text input under the hood (so browsers show no spinner arrows) and implements
 * ControlValueAccessor, so the form control always holds a number, or null when the box is empty.
 * Text that is not a number makes the control invalid (`{ number: true }`) instead of being read as 0.
 *
 * Usage: `<input appNumber formControlName="homePrice" />`, or `[decimals]="4"` for rates.
 */
@Directive({
  selector: 'input[appNumber]',
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
    '(input)': 'onInput($any($event.target).value)',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumberInputDirective), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NumberInputDirective), multi: true },
  ],
})
export class NumberInputDirective implements ControlValueAccessor, Validator {
  private readonly element = inject(ElementRef<HTMLInputElement>).nativeElement as HTMLInputElement;

  /** The most decimal places shown when formatted (2 for money, 4 for rates). */
  readonly decimals = input(2);

  private value: number | null = null;
  private unreadable = false;
  private editing = false;
  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  /** Shows a value set from code (or the form's initial value). */
  writeValue(value: number | null): void {
    this.value = value;
    this.unreadable = false;
    this.render();
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.element.disabled = disabled;
  }

  /** Reports text that could not be read as a number. */
  validate(_: AbstractControl): ValidationErrors | null {
    return this.unreadable ? { number: true } : null;
  }

  /**
   * Switches to the plain number for editing and selects it all. Replacing the text drops any
   * selection, so without this, typing into a tabbed-to box would append to the old number.
   */
  onFocus(): void {
    this.editing = true;
    this.render();
    this.element.select();
  }

  /** Formats again when editing ends. */
  onBlur(): void {
    this.editing = false;
    this.render();
    this.onTouched();
  }

  /** Parses what was typed; commas, spaces and a dollar sign are ignored. */
  onInput(text: string): void {
    const cleaned = text.replace(/[,\s$]/g, '');
    const parsed = cleaned === '' ? null : Number(cleaned);
    this.unreadable = parsed !== null && Number.isNaN(parsed);
    this.value = this.unreadable ? null : parsed;
    this.onChange(this.value);
  }

  private render(): void {
    if (this.unreadable) return; // leave the user's text alone so they can fix it
    this.element.value = this.value === null || this.value === undefined
      ? ''
      : this.editing
        ? String(this.value)
        : this.value.toLocaleString('en-US', { maximumFractionDigits: this.decimals() });
  }
}
