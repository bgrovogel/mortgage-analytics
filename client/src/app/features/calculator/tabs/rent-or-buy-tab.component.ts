import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { CalculatorStore } from '../calculator.store';
import { RentOrBuyComponent } from '../rent-or-buy/rent-or-buy.component';

/** Renting's cost and what money earns, with the limits the API enforces (AmortizationRequestValidator). */
const RENT_RULES = {
  monthlyRent: { label: 'Rent a month', unit: '$', min: 0.01, max: 1_000_000, optional: true },
  rentIncreasePercent: { label: 'Rent rises', unit: '%', min: -20, max: 20, decimals: 2 },
  investmentReturnPercent: { label: 'Investments earn', unit: '%', min: -20, max: 30, decimals: 2 },
  maintenancePercent: { label: 'Upkeep', unit: '%', min: 0, max: 10, decimals: 2 },
  sellingCostPercent: { label: 'Selling costs', unit: '%', min: 0, max: 20, decimals: 2 },
} as const satisfies FieldRules;

/** The usual assumptions: rent up 3.5% a year, investments earning 7%, 1% upkeep, 6% to sell. */
const DEFAULTS = { rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6 };

/**
 * Rent or buy: the rent for a similar home and what is assumed, set here beside the answer, then buying against
 * renting year by year. Until a rent is given, it says what it would show.
 */
@Component({
  selector: 'app-rent-or-buy-tab',
  imports: [CurrencyPipe, NumberFieldComponent, RentOrBuyComponent],
  template: `
    <div class="panel rent-or-buy">
      <h2>Should you rent or buy?</h2>
      <p class="intro">Buying this home against renting a similar one: what each would leave you, year by year.</p>
      <div class="settings" data-testid="rent-settings">
        <app-number-field [control]="form.controls.monthlyRent" [rule]="rules.monthlyRent" testId="monthly-rent" placeholder="e.g. 2,200" />
        <app-number-field [control]="form.controls.rentIncreasePercent" [rule]="rules.rentIncreasePercent" testId="rent-increase" />
        <app-number-field [control]="form.controls.investmentReturnPercent" [rule]="rules.investmentReturnPercent" testId="investment-return" />
        <app-number-field [control]="form.controls.maintenancePercent" [rule]="rules.maintenancePercent" testId="maintenance" />
        <app-number-field [control]="form.controls.sellingCostPercent" [rule]="rules.sellingCostPercent" testId="selling-costs" />
      </div>
      <p class="hint">
        The rent for a similar home now. The rent's rise, what investments earn and upkeep are a year; upkeep and selling
        costs are shares of the home's value.
      </p>
      @if (result().rentOrBuy; as comparison) {
        <app-rent-or-buy [comparison]="comparison" />
      } @else {
        <p class="prompt" data-testid="rent-or-buy-empty">
          Enter the rent for a similar home to see when buying comes out ahead, or
          <button type="button" class="try" (click)="tryRent()" data-testid="try-rent">Try {{ suggestedRent() | currency: 'USD' : 'symbol' : '1.0-0' }} a month</button>
          (about 0.65% of the price, a common rule of thumb).
        </p>
      }
    </div>
  `,
  styleUrls: ['./result-tab.scss', './rent-or-buy-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentOrBuyTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  protected readonly result = computed(() => this.store.result()!);

  protected readonly rules = RENT_RULES;

  /** A rent to try before the buyer knows one: about 0.65% of the price a month, to the nearest $25. */
  protected readonly suggestedRent = computed(() => Math.max(25, Math.round((this.result().purchase.homePrice * 0.0065) / 25) * 25));

  protected tryRent(): void {
    this.form.controls.monthlyRent.setValue(this.suggestedRent());
  }

  /** Starts from what the calculator weighs now (a saved calculation's rent), or the usual assumptions and no rent. */
  protected readonly form = inject(NonNullableFormBuilder).group({
    monthlyRent: [this.store.rentSettings()?.monthlyRent ?? (null as number | null), validatorsFor(RENT_RULES.monthlyRent)],
    rentIncreasePercent: [this.store.rentSettings()?.rentIncreasePercent ?? DEFAULTS.rentIncreasePercent, validatorsFor(RENT_RULES.rentIncreasePercent)],
    investmentReturnPercent: [this.store.rentSettings()?.investmentReturnPercent ?? DEFAULTS.investmentReturnPercent, validatorsFor(RENT_RULES.investmentReturnPercent)],
    maintenancePercent: [this.store.rentSettings()?.maintenancePercent ?? DEFAULTS.maintenancePercent, validatorsFor(RENT_RULES.maintenancePercent)],
    sellingCostPercent: [this.store.rentSettings()?.sellingCostPercent ?? DEFAULTS.sellingCostPercent, validatorsFor(RENT_RULES.sellingCostPercent)],
  });

  constructor() {
    // Every change in range weighs it again; a rent cleared stops weighing it.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.form.valid) return;
      const { monthlyRent, ...assumptions } = this.form.getRawValue();
      this.store.setRentSettings(monthlyRent ? { monthlyRent, ...assumptions } : null);
    });
  }
}
