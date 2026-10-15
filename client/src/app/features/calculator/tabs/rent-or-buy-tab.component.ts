import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../calculator.store';
import { RENT_DEFAULTS } from '../rent-settings/rent-settings.component';
import { RentOrBuyComponent } from '../rent-or-buy/rent-or-buy.component';

/**
 * Rent or buy: buying against renting year by year, once a rent is given (beside the other numbers, in the form).
 * Until then, it says what it would show, and offers a rent to try.
 */
@Component({
  selector: 'app-rent-or-buy-tab',
  imports: [CurrencyPipe, RentOrBuyComponent],
  template: `
    <div class="panel rent-or-buy">
      <h2>Should you rent or buy?</h2>
      <p class="intro">Buying this home against renting a similar one: what each would leave you, year by year. The rent and what is assumed are with your numbers, on the left.</p>
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

  /** A rent to try before the buyer knows one: about 0.65% of the price a month, to the nearest $25. */
  protected readonly suggestedRent = computed(() => Math.max(25, Math.round((this.result().purchase.homePrice * 0.0065) / 25) * 25));

  /** Weighs buying against that rent, with the usual assumptions; the form's boxes follow. */
  protected tryRent(): void {
    this.store.setRentSettings({ monthlyRent: this.suggestedRent(), ...RENT_DEFAULTS });
  }
}
