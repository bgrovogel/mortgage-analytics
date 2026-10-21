import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { decimal, usd } from '../../../core/formatting/format';
import { SecondLoanInput } from '../../../core/models/amortization.models';
import { DialogComponent } from '../../../core/layout/dialog.component';
import { CalculatorStore } from '../calculator.store';
import { CashToCloseComponent } from '../cash-to-close/cash-to-close.component';
import { LoanEstimateBoxComponent } from '../loan-estimate-box/loan-estimate-box.component';
import { SavingUpComponent } from '../saving-up/saving-up.component';
import { SecondLoanComponent } from '../second-loan/second-loan.component';
import { SellerOfferComponent } from '../seller-offer/seller-offer.component';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t } from '../../../core/i18n/i18n';

/**
 * Closing: the cash to close, line by line with what a seller or builder may pay, and how long it takes to save. What a
 * lender's Loan Estimate compares and the best use of a seller's money are one step away, each in its own dialog, so
 * the page holds the one answer it is for. Without an offer, it says what the seller's part would show and where to enter one.
 */
@Component({
  selector: 'app-closing-tab',
  imports: [CashToCloseComponent, DialogComponent, LoanEstimateBoxComponent, SavingUpComponent, SecondLoanComponent, SellerOfferComponent, TPipe],
  template: `
    @if (result().cashToClose; as cash) {
      <div class="panel"><app-cash-to-close [cash]="cash" [program]="result().program" /></div>
      <div class="panel" data-testid="saving-up"><app-saving-up [target]="cash.total" /></div>
    }

    <section class="panel steps" aria-labelledby="closing-more">
      <h2 id="closing-more">{{ 'More about closing' | t }}</h2>
      <ul>
        <li data-testid="loan-estimate-row">
          <div>
            <h3>{{ 'Comparing offers' | t }}</h3>
            <p data-testid="loan-estimate-summary">{{ estimateSummary() }}</p>
          </div>
          <button type="button" (click)="estimate.open()" data-testid="open-loan-estimate">{{ 'See the figures' | t }}</button>
        </li>
        <li data-testid="second-loan-row">
          <div>
            <h3>{{ 'A second loan instead of PMI' | t }}</h3>
            <p data-testid="second-loan-summary">{{ secondLoanSummary() }}</p>
          </div>
          <button type="button" (click)="second.open()" data-testid="open-second-loan">{{ result().secondLoan ? ('See the figures' | t) : ('Try it' | t) }}</button>
          <app-dialog #second [heading]="'A second loan instead of PMI' | t">
            <app-second-loan [comparison]="result().secondLoan ?? null" [settings]="store.secondLoanSettings()" [suggestion]="suggestedSecondLoan()"
                             (settingsChange)="store.setSecondLoanSettings($event)" />
          </app-dialog>
        </li>
        @if (result().sellerOffer; as offer) {
          <li data-testid="seller-offer-row">
            <div>
              <h3>{{ 'The seller’s money' | t }}</h3>
              <p>{{ 'Taking the {0} four ways: off the price, toward closing, as a 2-1 buydown or as points.' | t: [money(offer.offer)] }}</p>
            </div>
            <button type="button" (click)="seller.open()" data-testid="open-seller-offer">{{ 'See the best use' | t }}</button>
            <app-dialog #seller [heading]="'The seller’s money, taken four ways' | t">
              <app-seller-offer [offer]="offer" [settings]="store.offerSettings()" (settingsChange)="store.setOfferSettings($event)" />
            </app-dialog>
          </li>
        } @else {
          <li data-testid="seller-offer-empty">
            <div>
              <h3>{{ 'Has the seller or builder offered money?' | t }}</h3>
              <p>
                {{ 'Enter it as seller credits (or choose a buydown the seller pays for), and this weighs the best way to take it: off the price, toward closing, as a 2-1 buydown, or as points.' | t }}
              </p>
            </div>
            <button type="button" (click)="addCredits()" data-testid="add-seller-credits">{{ 'Add seller credits' | t }}</button>
          </li>
        }
      </ul>
    </section>

    <app-dialog #estimate [heading]="'Comparing offers' | t" data-testid="loan-estimate-box">
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
    const parts = [apr != null ? t('APR {0}%', [decimal(apr, 3)]) : null, five ? t('{0} paid in 5 years', [usd(five.totalPaid)]) : null].filter(Boolean);
    return parts.length > 0 ? t("The figures a lender's Loan Estimate lists: {0}.", [parts.join(', ')]) : t("The figures a lender's Loan Estimate lists.");
  });

  /** What the second-loan comparison holds, in a line, so the way into it says what is there. */
  protected readonly secondLoanSummary = computed(() => {
    const c = this.result().secondLoan;
    if (c) {
      return c.saved >= 0
        ? t('A {0} second loan costs {1} less than PMI over {2} years.', [usd(c.amount), usd(c.saved), c.yearsKept])
        : t('A {0} second loan costs {1} more than PMI over {2} years.', [usd(c.amount), usd(-c.saved), c.yearsKept]);
    }
    return this.suggestedSecondLoan()
      ? t('Paying PMI? Compare it with a smaller first loan and a second loan for the rest.')
      : t('No PMI here: at least 20% is put down.');
  });

  /**
   * The usual second loan: the amount that brings the first loan to 80% of the price (what takes PMI off), two points
   * above the first loan's rate, over 15 years, kept 7. Null when 20% is already down.
   */
  protected readonly suggestedSecondLoan = computed<SecondLoanInput | null>(() => {
    const { purchase } = this.result();
    const amount = Math.round((purchase.homePrice * 0.2 - purchase.downPayment) * 100) / 100;
    const rate = this.store.request()?.annualInterestRate ?? 0;
    return amount > 0 ? { amount, annualInterestRate: Math.min(30, Math.round((rate + 2) * 1000) / 1000), termInMonths: 180, yearsKept: 7 } : null;
  });

  /** Opens the form's closing costs with the cursor in the seller credits. */
  protected addCredits(): void {
    this.navigator.open('closing', 'closing-credits');
  }
}
