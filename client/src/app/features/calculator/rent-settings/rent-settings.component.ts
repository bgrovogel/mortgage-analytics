import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { CalculatorStore } from '../calculator.store';

/** Renting's cost and what money earns, with the limits the API enforces (AmortizationRequestValidator). */
export const RENT_RULES = {
  monthlyRent: { label: 'Rent a month', unit: '$', min: 0.01, max: 1_000_000, optional: true },
  rentIncreasePercent: { label: 'Rent rises', unit: '%', min: -20, max: 20, decimals: 2 },
  investmentReturnPercent: { label: 'Investments earn', unit: '%', min: -20, max: 30, decimals: 2 },
  maintenancePercent: { label: 'Upkeep', unit: '%', min: 0, max: 10, decimals: 2 },
  sellingCostPercent: { label: 'Selling costs', unit: '%', min: 0, max: 20, decimals: 2 },
} as const satisfies FieldRules;

/** The usual assumptions: rent up 3.5% a year, investments earning 7%, 1% upkeep, 6% to sell. */
export const RENT_DEFAULTS = { rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6 };

/**
 * The rent for a similar home and what is assumed, beside the other numbers while the question is rent or buy. Every
 * change in range weighs buying against renting again; a rent cleared stops weighing it. Its settings live in the
 * store, so the answer (and a rent tried from the result) and these boxes always agree.
 */
@Component({
  selector: 'app-rent-settings',
  imports: [NumberFieldComponent],
  template: `
    <fieldset class="question" data-testid="rent-settings">
      <legend>For this question</legend>
      <app-number-field [control]="form.controls.monthlyRent" [rule]="rules.monthlyRent" testId="monthly-rent" label="Rent for a similar home, a month" placeholder="e.g. 2,200" />
      <div class="pair">
        <app-number-field [control]="form.controls.rentIncreasePercent" [rule]="rules.rentIncreasePercent" testId="rent-increase" label="Rent rises each year" />
        <app-number-field [control]="form.controls.investmentReturnPercent" [rule]="rules.investmentReturnPercent" testId="investment-return" label="Investments earn" />
        <app-number-field [control]="form.controls.maintenancePercent" [rule]="rules.maintenancePercent" testId="maintenance" label="Upkeep of the home" />
        <app-number-field [control]="form.controls.sellingCostPercent" [rule]="rules.sellingCostPercent" testId="selling-costs" label="Cost to sell" />
      </div>
      <p class="hint">
        The rent's rise, what investments earn and upkeep are a year; upkeep and selling costs are shares of the home's value.
      </p>
    </fieldset>
  `,
  styleUrl: './rent-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentSettingsComponent {
  private readonly store = inject(CalculatorStore);

  protected readonly rules = RENT_RULES;

  /** Starts from what the calculator weighs now (a saved calculation's rent), or the usual assumptions and no rent. */
  protected readonly form = inject(NonNullableFormBuilder).group({
    monthlyRent: [this.store.rentSettings()?.monthlyRent ?? (null as number | null), validatorsFor(RENT_RULES.monthlyRent)],
    rentIncreasePercent: [this.store.rentSettings()?.rentIncreasePercent ?? RENT_DEFAULTS.rentIncreasePercent, validatorsFor(RENT_RULES.rentIncreasePercent)],
    investmentReturnPercent: [this.store.rentSettings()?.investmentReturnPercent ?? RENT_DEFAULTS.investmentReturnPercent, validatorsFor(RENT_RULES.investmentReturnPercent)],
    maintenancePercent: [this.store.rentSettings()?.maintenancePercent ?? RENT_DEFAULTS.maintenancePercent, validatorsFor(RENT_RULES.maintenancePercent)],
    sellingCostPercent: [this.store.rentSettings()?.sellingCostPercent ?? RENT_DEFAULTS.sellingCostPercent, validatorsFor(RENT_RULES.sellingCostPercent)],
  });

  constructor() {
    // Every change in range weighs it again; a rent cleared stops weighing it.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.form.valid) return;
      const { monthlyRent, ...assumptions } = this.form.getRawValue();
      this.store.setRentSettings(monthlyRent ? { monthlyRent, ...assumptions } : null);
    });

    // A rent set from the answer ("Try $2,700 a month"), or a saved calculation's, fills the boxes.
    effect(() => {
      const settings = this.store.rentSettings();
      if (settings && settings.monthlyRent !== this.form.controls.monthlyRent.value) {
        this.form.patchValue(settings, { emitEvent: false });
      }
    });
  }
}
