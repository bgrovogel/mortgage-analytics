import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { RentOrBuyInput } from '../../../core/models/amortization.models';
import { FILING_STATUSES } from '../../../core/models/filing-statuses';
import { TaxFilingStatus } from '../../../core/models/strategy.models';
import { CalculatorStore } from '../calculator.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** Renting's cost and what money earns, with the limits the API enforces (AmortizationRequestValidator). */
export const RENT_RULES = {
  monthlyRent: { get label() { return t('Rent a month'); }, unit: '$', min: 0.01, max: 1_000_000, optional: true },
  rentIncreasePercent: { get label() { return t('Rent rises'); }, unit: '%', min: -20, max: 20, decimals: 2 },
  investmentReturnPercent: { get label() { return t('Investments earn'); }, unit: '%', min: -20, max: 30, decimals: 2 },
  maintenancePercent: { get label() { return t('Upkeep'); }, unit: '%', min: 0, max: 10, decimals: 2 },
  sellingCostPercent: { get label() { return t('Selling costs'); }, unit: '%', min: 0, max: 20, decimals: 2 },
  marginalTaxRatePercent: { get label() { return t('Your federal tax rate'); }, unit: '%', min: 0, max: 50, decimals: 2 },
  otherStateAndLocalTaxes: { get label() { return t('Other state and local taxes'); }, unit: '$', min: 0, max: 100_000_000, optional: true },
  otherItemizedDeductions: { get label() { return t('Other itemized deductions'); }, unit: '$', min: 0, max: 100_000_000, optional: true },
} as const satisfies FieldRules;

/** The usual assumptions: rent up 3.5% a year, investments earning 7%, 1% upkeep, 6% to sell. */
export const RENT_DEFAULTS = { rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6 };

/** What counting the tax savings starts from: a single filer in the 24% bracket, with nothing else to deduct. */
export const OWNER_TAX_DEFAULTS = { filingStatus: 'Single' as TaxFilingStatus, marginalTaxRatePercent: 24, otherStateAndLocalTaxes: 0, otherItemizedDeductions: 0 };

/**
 * The rent for a similar home and what is assumed, beside the other numbers while the question is rent or buy. Every
 * change in range weighs buying against renting again; a rent cleared stops weighing it. Its settings live in the
 * store, so the answer (and a rent tried from the result) and these boxes always agree.
 */
@Component({
  selector: 'app-rent-settings',
  imports: [NumberFieldComponent, ReactiveFormsModule, TPipe],
  template: `
    <fieldset class="question" data-testid="rent-settings">
      <legend>{{ 'For this question' | t }}</legend>
      <app-number-field [control]="form.controls.monthlyRent" [rule]="rules.monthlyRent" testId="monthly-rent" [label]="'Rent for a similar home, a month' | t" placeholder="e.g. 2,200" />
      <div class="pair">
        <app-number-field [control]="form.controls.rentIncreasePercent" [rule]="rules.rentIncreasePercent" testId="rent-increase" [label]="'Rent rises each year' | t" />
        <app-number-field [control]="form.controls.investmentReturnPercent" [rule]="rules.investmentReturnPercent" testId="investment-return" [label]="'Investments earn' | t" />
        <app-number-field [control]="form.controls.maintenancePercent" [rule]="rules.maintenancePercent" testId="maintenance" [label]="'Upkeep of the home' | t" />
        <app-number-field [control]="form.controls.sellingCostPercent" [rule]="rules.sellingCostPercent" testId="selling-costs" [label]="'Cost to sell' | t" />
      </div>
      <p class="hint">
        {{ "The rent's rise, what investments earn and upkeep are a year; upkeep and selling costs are shares of the home's value." | t }}
      </p>
      <label class="count-tax">
        <input type="checkbox" [formControl]="form.controls.countTax" data-testid="count-tax" />
        <span><strong>{{ 'Count the tax savings of owning' | t }}</strong></span>
      </label>
      @if (form.controls.countTax.value) {
        <label class="status">
          <span>{{ 'Filing status' | t }}</span>
          <select [formControl]="form.controls.filingStatus" data-testid="filing-status">
            @for (status of filingStatuses; track status.value) {
              <option [value]="status.value">{{ status.label }}</option>
            }
          </select>
        </label>
        <div class="pair">
          <app-number-field [control]="form.controls.marginalTaxRatePercent" [rule]="rules.marginalTaxRatePercent" testId="tax-rate" [label]="'Your federal tax rate' | t" />
          <app-number-field [control]="form.controls.otherStateAndLocalTaxes" [rule]="rules.otherStateAndLocalTaxes" testId="other-state-local-taxes" [label]="'Other state and local taxes a year' | t" />
          <app-number-field [control]="form.controls.otherItemizedDeductions" [rule]="rules.otherItemizedDeductions" testId="other-deductions" [label]="'Charity and other deductions a year' | t" />
        </div>
        <p class="hint" data-testid="tax-hint">
          {{ 'Owning lowers your federal tax when the mortgage interest and the property tax, with your other deductions, beat the standard deduction. Figures for 2026: state and local taxes count up to $40,400, and the deductions are taken to rise with prices.' | t }}
        </p>
      }
    </fieldset>
  `,
  styleUrl: './rent-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentSettingsComponent {
  private readonly store = inject(CalculatorStore);

  protected readonly rules = RENT_RULES;
  protected readonly filingStatuses = FILING_STATUSES;

  /** Starts from what the calculator weighs now (a saved calculation's rent), or the usual assumptions and no rent. */
  protected readonly form = inject(NonNullableFormBuilder).group({
    monthlyRent: [this.store.rentSettings()?.monthlyRent ?? (null as number | null), validatorsFor(RENT_RULES.monthlyRent)],
    rentIncreasePercent: [this.store.rentSettings()?.rentIncreasePercent ?? RENT_DEFAULTS.rentIncreasePercent, validatorsFor(RENT_RULES.rentIncreasePercent)],
    investmentReturnPercent: [this.store.rentSettings()?.investmentReturnPercent ?? RENT_DEFAULTS.investmentReturnPercent, validatorsFor(RENT_RULES.investmentReturnPercent)],
    maintenancePercent: [this.store.rentSettings()?.maintenancePercent ?? RENT_DEFAULTS.maintenancePercent, validatorsFor(RENT_RULES.maintenancePercent)],
    sellingCostPercent: [this.store.rentSettings()?.sellingCostPercent ?? RENT_DEFAULTS.sellingCostPercent, validatorsFor(RENT_RULES.sellingCostPercent)],
    // The tax saving of owning: left out until asked for, then from these.
    countTax: [!!this.store.rentSettings()?.ownerTaxes],
    filingStatus: [this.store.rentSettings()?.ownerTaxes?.filingStatus ?? OWNER_TAX_DEFAULTS.filingStatus],
    marginalTaxRatePercent: [this.store.rentSettings()?.ownerTaxes?.marginalTaxRatePercent ?? OWNER_TAX_DEFAULTS.marginalTaxRatePercent, validatorsFor(RENT_RULES.marginalTaxRatePercent)],
    otherStateAndLocalTaxes: [this.store.rentSettings()?.ownerTaxes?.otherStateAndLocalTaxes ?? (OWNER_TAX_DEFAULTS.otherStateAndLocalTaxes as number | null), validatorsFor(RENT_RULES.otherStateAndLocalTaxes)],
    otherItemizedDeductions: [this.store.rentSettings()?.ownerTaxes?.otherItemizedDeductions ?? (OWNER_TAX_DEFAULTS.otherItemizedDeductions as number | null), validatorsFor(RENT_RULES.otherItemizedDeductions)],
  });

  constructor() {
    // Every change in range weighs it again; a rent cleared stops weighing it.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.form.valid) return;
      const { monthlyRent, rentIncreasePercent, investmentReturnPercent, maintenancePercent, sellingCostPercent, countTax, ...tax } = this.form.getRawValue();
      const settings: RentOrBuyInput | null = monthlyRent
        ? {
            monthlyRent, rentIncreasePercent, investmentReturnPercent, maintenancePercent, sellingCostPercent,
            // Left out, not null, when not counted: a request without it asks for no tax.
            ...(countTax && { ownerTaxes: { ...tax, otherStateAndLocalTaxes: tax.otherStateAndLocalTaxes ?? 0, otherItemizedDeductions: tax.otherItemizedDeductions ?? 0 } }),
          }
        : null;
      this.store.setRentSettings(settings);
    });

    // A rent set from the answer ("Try $2,700 a month"), or a saved calculation's, fills the boxes.
    effect(() => {
      const settings = this.store.rentSettings();
      if (settings && settings.monthlyRent !== this.form.controls.monthlyRent.value) {
        const { ownerTaxes, ...rest } = settings;
        this.form.patchValue({ ...rest, countTax: !!ownerTaxes, ...(ownerTaxes ?? OWNER_TAX_DEFAULTS) }, { emitEvent: false });
      }
    });
  }
}
