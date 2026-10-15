import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { decimal, usd } from '../../../core/formatting/format';
import { DialogComponent } from '../../../core/layout/dialog.component';
import { CalculatorStore } from '../calculator.store';
import { CashToCloseComponent } from '../cash-to-close/cash-to-close.component';
import { LoanEstimateBoxComponent } from '../loan-estimate-box/loan-estimate-box.component';
import { SavingUpComponent } from '../saving-up/saving-up.component';
import { SellerOfferComponent } from '../seller-offer/seller-offer.component';

/**
 * Closing: the cash to close, line by line with what a seller or builder may pay, and how long it takes to save. What a
 * lender's Loan Estimate compares and the best use of a seller's money are one step away, each in its own dialog, so
 * the page holds the one answer it is for. Without an offer, it says what the seller's part would show and where to enter one.
 */
@Component({
  selector: 'app-closing-tab',
  imports: [CashToCloseComponent, DialogComponent, LoanEstimateBoxComponent, SavingUpComponent, SellerOfferComponent],
  template: `
    @if (result().cashToClose; as cash) {
      <div class="panel"><app-cash-to-close [cash]="cash" [program]="result().program" /></div>
      <div class="panel" data-testid="saving-up"><app-saving-up [target]="cash.total" /></div>
    }

    <section class="panel steps" aria-labelledby="closing-more">
      <h2 id="closing-more">More about closing</h2>
      <ul>
        <li data-testid="loan-estimate-row">
          <div>
            <h3>Comparing offers</h3>
            <p data-testid="loan-estimate-summary">{{ estimateSummary() }}</p>
          </div>
          <button type="button" (click)="estimate.open()" data-testid="open-loan-estimate">See the figures</button>
        </li>
        @if (result().sellerOffer; as offer) {
          <li data-testid="seller-offer-row">
            <div>
              <h3>The seller’s money</h3>
              <p>Taking the {{ money(offer.offer) }} four ways: off the price, toward closing, as a 2-1 buydown or as points.</p>
            </div>
            <button type="button" (click)="seller.open()" data-testid="open-seller-offer">See the best use</button>
            <app-dialog #seller heading="The seller’s money, taken four ways">
              <app-seller-offer [offer]="offer" [settings]="store.offerSettings()" (settingsChange)="store.setOfferSettings($event)" />
            </app-dialog>
          </li>
        } @else {
          <li data-testid="seller-offer-empty">
            <div>
              <h3>Has the seller or builder offered money?</h3>
              <p>
                Enter it as seller credits (or choose a buydown the seller pays for), and this weighs the best way to take
                it: off the price, toward closing, as a 2-1 buydown, or as points.
              </p>
            </div>
            <button type="button" (click)="addCredits()" data-testid="add-seller-credits">Add seller credits</button>
          </li>
        }
      </ul>
    </section>

    <app-dialog #estimate heading="Comparing offers" data-testid="loan-estimate-box">
      <app-loan-estimate-box [result]="result()" />
    </app-dialog>
  `,
  styleUrls: ['./result-tab.scss', './closing-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosingTabComponent {
  protected readonly store = inject(CalculatorStore);
  private readonly navigator = inject(FormNavigator);

  protected readonly money = usd;

  /** The page only shows the tabs once there is a result. */
  protected readonly result = computed(() => this.store.result()!);

  /** What the Loan Estimate comparison holds, in a line, so the way into it says what is there. */
  protected readonly estimateSummary = computed(() => {
    const { annualPercentageRate: apr, inFiveYears: five } = this.result();
    const parts = [apr != null ? `APR ${decimal(apr, 3)}%` : null, five ? `${usd(five.totalPaid)} paid in 5 years` : null];
    return `The figures a lender's Loan Estimate lists${parts.some(Boolean) ? `: ${parts.filter(Boolean).join(', ')}` : ''}.`;
  });

  /** Opens the form's closing costs with the cursor in the seller credits. */
  protected addCredits(): void {
    this.navigator.open('closing', 'closing-credits');
  }
}
