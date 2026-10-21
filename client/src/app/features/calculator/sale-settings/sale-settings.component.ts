import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { FILING_STATUSES } from '../../../core/models/filing-statuses';
import { CalculatorStore } from '../calculator.store';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/** What a sale costs and how its gain is taxed, with the limits the API enforces (AmortizationRequestValidator). */
export const SALE_RULES = {
  sellingCostPercent: { get label() { return t('Cost to sell'); }, unit: '%', min: 0, max: 20, decimals: 2 },
  gainsTaxRatePercent: { get label() { return t('Tax rate on the gain'); }, unit: '%', min: 0, max: 40, decimals: 2 },
} as const satisfies FieldRules;

/**
 * What selling costs and how a gain is taxed, beside the other numbers while the question is what a sale would leave.
 * Every change in range works the sale out again. The settings live in the store, so the answer and these boxes agree.
 */
@Component({
  selector: 'app-sale-settings',
  imports: [NumberFieldComponent, ReactiveFormsModule, TPipe],
  template: `
    <fieldset class="question" data-testid="sale-settings">
      <legend>{{ 'For this question' | t }}</legend>
      <div class="pair">
        <app-number-field [control]="form.controls.sellingCostPercent" [rule]="rules.sellingCostPercent" testId="sale-costs" [label]="'Cost to sell' | t" />
        <app-number-field [control]="form.controls.gainsTaxRatePercent" [rule]="rules.gainsTaxRatePercent" testId="sale-tax-rate" [label]="'Tax rate on the gain' | t" />
      </div>
      <label class="status">
        <span>{{ 'Filing status' | t }}</span>
        <select [formControl]="form.controls.filingStatus" data-testid="sale-filing-status">
          @for (status of filingStatuses; track status.value) {
            <option [value]="status.value">{{ status.label }}</option>
          }
        </select>
      </label>
      <p class="hint">
        {{ "Selling costs are a share of the home's value then. A long-term gain is taxed at 0%, 15% or 20% (3.8% more at high incomes). A home you live in shelters the first $250,000 of gain from tax, $500,000 for a couple filing jointly." | t }}
      </p>
    </fieldset>
  `,
  styleUrl: './sale-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleSettingsComponent {
  private readonly store = inject(CalculatorStore);

  protected readonly rules = SALE_RULES;
  protected readonly filingStatuses = FILING_STATUSES;

  /** Starts from what the sale is weighed with now (a saved calculation's, or the usual). */
  protected readonly form = inject(NonNullableFormBuilder).group({
    sellingCostPercent: [this.store.saleSettings().sellingCostPercent, validatorsFor(SALE_RULES.sellingCostPercent)],
    gainsTaxRatePercent: [this.store.saleSettings().gainsTaxRatePercent, validatorsFor(SALE_RULES.gainsTaxRatePercent)],
    filingStatus: [this.store.saleSettings().filingStatus],
  });

  constructor() {
    // Every change in range works the sale out again.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.valid) this.store.setSaleSettings(this.form.getRawValue());
    });

    // A saved calculation's settings fill the boxes.
    effect(() => {
      const settings = this.store.saleSettings();
      if (JSON.stringify(settings) !== JSON.stringify(this.form.getRawValue())) this.form.patchValue(settings, { emitEvent: false });
    });
  }
}
