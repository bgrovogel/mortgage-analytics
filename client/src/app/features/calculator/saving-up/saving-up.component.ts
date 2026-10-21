import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { FieldRule, MAX_AMOUNT } from '../../../core/forms/field-rules';
import { formatMonths } from '../../../core/formatting/duration';
import { decimal, usd } from '../../../core/formatting/format';
import { monthsToSave } from './saving-up';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

const RULES = {
  savedSoFar: { get label() { return t('Saved so far'); }, unit: '$', min: 0, max: MAX_AMOUNT, optional: true },
  monthly: { get label() { return t('You can save a month'); }, unit: '$', min: 0, max: MAX_AMOUNT, optional: true },
  rate: { get label() { return t('Savings earn a year'); }, unit: '%', min: 0, max: 30, optional: true },
} as const satisfies Record<string, FieldRule>;

/**
 * "How long until I can close?": what the cash to close takes to save, from what is saved already and what can be put
 * away each month. Its figures are its own, a way to think about the cash: they are not part of the loan.
 */
@Component({
  selector: 'app-saving-up',
  imports: [NumberFieldComponent, TPipe],
  template: `
    <h2>{{ 'How long to save it?' | t }}</h2>
    <div class="row">
      <app-number-field [control]="form.controls.savedSoFar" [rule]="rules.savedSoFar" testId="saved-so-far" />
      <app-number-field [control]="form.controls.monthly" [rule]="rules.monthly" testId="saved-monthly" />
      <app-number-field [control]="form.controls.rate" [rule]="rules.rate" testId="saved-rate" />
    </div>
    <p class="answer" data-testid="saving-up-answer">{{ answer() }}</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    h2 {
      margin: 0;
      font-size: 1rem;
    }

    .row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 0.75rem;
    }

    .answer {
      margin: 0;
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavingUpComponent {
  /** The cash to close: what is being saved for. */
  readonly target = input.required<number>();

  protected readonly rules = RULES;

  protected readonly form = new FormGroup({
    savedSoFar: new FormControl<number | null>(0),
    monthly: new FormControl<number | null>(1_000),
    rate: new FormControl<number | null>(4),
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  protected readonly answer = computed(() => {
    const { savedSoFar, monthly, rate } = this.values();
    const target = this.target();
    if (monthly === null || monthly === undefined) return t('Enter what you can save each month.');
    const saved = savedSoFar ?? 0;
    if (saved >= target) return t('You already have it: {0} saved covers the {1} to close.', [usd(saved), usd(target)]);
    const months = monthsToSave(target, saved, monthly, rate ?? 0);
    if (months === null) {
      return monthly === 0
        ? t('Saving nothing a month, you would not get there in fifty years.')
        : t('At {0} a month, you would not get there in fifty years.', [usd(monthly)]);
    }
    return t('At {0} a month, earning {1}%, you would have {2} in {3}.', [usd(monthly), decimal(rate ?? 0), usd(target), formatMonths(months)]);
  });
}
