import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../calculator.store';
import { RENTAL_DEFAULTS } from '../rental-settings/rental-settings.component';
import { RentalComponent } from '../rental/rental.component';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * As a rental: the home let out, measured as an investment, once a rent is given (beside the other numbers, in the form).
 * Until then, it says what it would show, and offers a rent to try.
 */
@Component({
  selector: 'app-rental-tab',
  imports: [CurrencyPipe, RentalComponent, TPipe],
  template: `
    <div class="panel flat rental">
      <h2 class="visually-hidden">{{ 'The home as a rental' | t }}</h2>
      @if (result().rental; as rental) {
        <p class="intro">{{ "What the home would earn if you let it out: the rent, less vacancy, a manager, upkeep and the costs of owning it, against the loan's payments. The rent and what is assumed are with your numbers, on the left." | t }}</p>
        <app-rental [rental]="rental" />
      } @else {
        <p class="prompt" data-testid="rental-empty">
          {{ 'What this home would earn if you let it out: its cash flow, cap rate and cash-on-cash return, year by year. Put the rent in the form. No rent in mind?' | t }}
        </p>
        <div class="try-row">
          <button type="button" class="try" (click)="tryRent()" data-testid="try-rental-rent">{{ 'Try {0} a month' | t: [(suggestedRent() | currency: 'USD' : 'symbol' : '1.0-0')] }}</button>
          <span class="prompt">{{ '(about 0.8% of the price, a common rule of thumb).' | t }}</span>
        </div>
      }
    </div>
  `,
  styleUrls: ['./result-tab.scss', './rental-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentalTabComponent {
  private readonly store = inject(CalculatorStore);

  /** The page only shows the tabs once there is a result. */
  protected readonly result = computed(() => this.store.result()!);

  /** A rent to try before the owner knows one: about 0.8% of the price a month, to the nearest $25. */
  protected readonly suggestedRent = computed(() => Math.max(25, Math.round((this.result().purchase.homePrice * 0.008) / 25) * 25));

  /** Measures the home at that rent, with the usual assumptions; the form's boxes follow. */
  protected tryRent(): void {
    this.store.setRentalSettings({ monthlyRent: this.suggestedRent(), ...RENTAL_DEFAULTS });
  }
}
