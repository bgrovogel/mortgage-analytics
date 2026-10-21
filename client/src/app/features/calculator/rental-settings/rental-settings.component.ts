import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { CalculatorStore } from '../calculator.store';

/** What letting the home out brings in and costs, with the limits the API enforces (AmortizationRequestValidator). */
export const RENTAL_RULES = {
  monthlyRent: { label: 'Rent a month', unit: '$', min: 0.01, max: 1_000_000, optional: true },
  vacancyPercent: { label: 'Vacancy', unit: '%', min: 0, max: 50, decimals: 2 },
  managementPercent: { label: 'Property manager', unit: '%', min: 0, max: 25, decimals: 2 },
  maintenancePercent: { label: 'Repairs and upkeep', unit: '%', min: 0, max: 10, decimals: 2 },
  rentIncreasePercent: { label: 'Rent rises', unit: '%', min: -20, max: 20, decimals: 2 },
} as const satisfies FieldRules;

/** The usual assumptions: 5% of the rent lost to vacancy, 8% to a manager, 1% of the value a year in upkeep, rent up 3% a year. */
export const RENTAL_DEFAULTS = { vacancyPercent: 5, managementPercent: 8, maintenancePercent: 1, rentIncreasePercent: 3 };

/**
 * The rent the home would fetch and what letting it costs, beside the other numbers while the question is how it does
 * as a rental. Every change in range measures it again; a rent cleared stops measuring it. The settings live in the
 * store, so the answer (and a rent tried from the result) and these boxes always agree.
 */
@Component({
  selector: 'app-rental-settings',
  imports: [NumberFieldComponent],
  template: `
    <fieldset class="question" data-testid="rental-settings">
      <legend>For this question</legend>
      <app-number-field [control]="form.controls.monthlyRent" [rule]="rules.monthlyRent" testId="rental-rent" label="Rent the home would fetch, a month" placeholder="e.g. 2,500" />
      <div class="pair">
        <app-number-field [control]="form.controls.vacancyPercent" [rule]="rules.vacancyPercent" testId="rental-vacancy" label="Rent lost to vacancy" />
        <app-number-field [control]="form.controls.managementPercent" [rule]="rules.managementPercent" testId="rental-management" label="Property manager" />
        <app-number-field [control]="form.controls.maintenancePercent" [rule]="rules.maintenancePercent" testId="rental-maintenance" label="Repairs and upkeep" />
        <app-number-field [control]="form.controls.rentIncreasePercent" [rule]="rules.rentIncreasePercent" testId="rental-rise" label="Rent rises each year" />
      </div>
      <p class="hint">
        Vacancy and the manager are shares of the rent; upkeep is a share of the home's value, a year. Taxes, insurance and
        dues come from the costs you entered. A manager of 0% is an owner who looks after it.
      </p>
    </fieldset>
  `,
  styleUrl: './rental-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentalSettingsComponent {
  private readonly store = inject(CalculatorStore);

  protected readonly rules = RENTAL_RULES;

  /** Starts from what the calculator measures now (a saved calculation's rent), or the usual assumptions and no rent. */
  protected readonly form = inject(NonNullableFormBuilder).group({
    monthlyRent: [this.store.rentalSettings()?.monthlyRent ?? (null as number | null), validatorsFor(RENTAL_RULES.monthlyRent)],
    vacancyPercent: [this.store.rentalSettings()?.vacancyPercent ?? RENTAL_DEFAULTS.vacancyPercent, validatorsFor(RENTAL_RULES.vacancyPercent)],
    managementPercent: [this.store.rentalSettings()?.managementPercent ?? RENTAL_DEFAULTS.managementPercent, validatorsFor(RENTAL_RULES.managementPercent)],
    maintenancePercent: [this.store.rentalSettings()?.maintenancePercent ?? RENTAL_DEFAULTS.maintenancePercent, validatorsFor(RENTAL_RULES.maintenancePercent)],
    rentIncreasePercent: [this.store.rentalSettings()?.rentIncreasePercent ?? RENTAL_DEFAULTS.rentIncreasePercent, validatorsFor(RENTAL_RULES.rentIncreasePercent)],
  });

  constructor() {
    // Every change in range measures it again; a rent cleared stops measuring it.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.form.valid) return;
      const { monthlyRent, ...assumptions } = this.form.getRawValue();
      this.store.setRentalSettings(monthlyRent ? { monthlyRent, ...assumptions } : null);
    });

    // A rent set from the answer ("Try $2,500 a month"), or a saved calculation's, fills the boxes.
    effect(() => {
      const settings = this.store.rentalSettings();
      if (settings && settings.monthlyRent !== this.form.controls.monthlyRent.value) this.form.patchValue(settings, { emitEvent: false });
    });
  }
}
