import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CalculatorStore } from '../calculator.store';
import { RENT_DEFAULTS } from '../rent-settings/rent-settings.component';
import { RentOrBuyComponent } from '../rent-or-buy/rent-or-buy.component';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Rent or buy: buying against renting year by year, once a rent is given (beside the other numbers, in the form).
 * Until then, it says what it would show, and offers a rent to try.
 */
@Component({
  selector: 'app-rent-or-buy-tab',
  imports: [CurrencyPipe, RentOrBuyComponent, TPipe],
  template: `
    <div class="panel flat rent-or-buy">
      @if (result().rentOrBuy; as comparison) {
        <h2 class="visually-hidden">{{ 'Should you rent or buy?' | t }}</h2>
        <p class="intro">{{ 'Buying this home against renting a similar one: what each would leave you, year by year. The rent and what is assumed are with your numbers, on the left.' | t }}</p>
        <app-rent-or-buy [comparison]="comparison" />
      } @else {
        <!-- The answer above already asks for the rent; this offers one to try. -->
        <p class="prompt" data-testid="rent-or-buy-empty">
          {{ 'Buying this home against renting a similar one, year by year. Put the rent in the form. No rent in mind?' | t }}
          <button type="button" class="try" (click)="tryRent()" data-testid="try-rent">{{ 'Try {0} a month' | t: [(suggestedRent() | currency: ('USD' | t) : 'symbol' : '1.0-0')] }}</button>
          {{ '(about 0.65% of the price, a common rule of thumb).' | t }}
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
