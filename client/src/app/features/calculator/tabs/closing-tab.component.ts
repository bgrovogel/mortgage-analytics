import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { CalculatorStore } from '../calculator.store';
import { CashToCloseComponent } from '../cash-to-close/cash-to-close.component';
import { LoanEstimateBoxComponent } from '../loan-estimate-box/loan-estimate-box.component';
import { SellerOfferComponent } from '../seller-offer/seller-offer.component';

/**
 * Closing: the cash to close, line by line with what a seller or builder may pay, then the best use of the money they
 * offer, with how it is weighed beside it. Without an offer, it says what that part would show and where to enter one.
 */
@Component({
  selector: 'app-closing-tab',
  imports: [CashToCloseComponent, LoanEstimateBoxComponent, SellerOfferComponent],
  template: `
    @if (result().cashToClose; as cash) {
      <div class="panel"><app-cash-to-close [cash]="cash" [program]="result().program" /></div>
    }
    <div class="panel" data-testid="loan-estimate-box"><app-loan-estimate-box [result]="result()" /></div>
    @if (result().sellerOffer; as offer) {
      <div class="panel">
        <app-seller-offer [offer]="offer" [settings]="store.offerSettings()" (settingsChange)="store.setOfferSettings($event)" />
      </div>
    } @else {
      <div class="panel empty" data-testid="seller-offer-empty">
        <h2>Has the seller or builder offered money?</h2>
        <p>
          Enter it as seller credits (or choose a buydown the seller pays for), and this tab weighs the best way to take
          it: off the price, toward closing, as a 2-1 buydown, or as points.
        </p>
        <button type="button" (click)="addCredits()" data-testid="add-seller-credits">Add seller credits</button>
      </div>
    }
  `,
  styleUrl: './result-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosingTabComponent {
  protected readonly store = inject(CalculatorStore);
  private readonly navigator = inject(FormNavigator);

  /** The page only shows the tabs once there is a result. */
  protected readonly result = computed(() => this.store.result()!);

  /** Opens the form's closing costs with the cursor in the seller credits. */
  protected addCredits(): void {
    this.navigator.open('closing', 'closing-credits');
  }
}
