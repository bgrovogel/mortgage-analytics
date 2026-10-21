import { Injectable, inject } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { describeComparison, suggestComparisonName } from '../../core/formatting/describe-inputs';
import { HomeComparisonRequest, HomeComparisonResponse } from '../../core/models/home-comparison.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { CalculationStore } from '../../core/state/calculation-store';
import { SharedLoan } from '../../core/state/shared-loan.store';
import { CalculatorStore, purchaseLoanOf, withoutIncome } from '../calculator/calculator.store';
import { msg, t } from '../../core/i18n/i18n';

/**
 * Up to four homes compared on the calculator's Compare tab. The first home is the calculator's own loan; each other
 * is a full set of inputs. Each is calculated by the calculator's endpoint, so the comparison needs nothing new from
 * the API but a place to save the other homes.
 */
@Injectable({ providedIn: 'root' })
export class ComparisonStore extends CalculationStore<HomeComparisonRequest, HomeComparisonResponse> {
  private readonly api = inject(AmortizationApiService);
  private readonly calculator = inject(CalculatorStore);

  readonly kind = 'HomeComparison';
  readonly route = ['/compare'];
  get pageName(): string {
    return t('Compare homes');
  }

  describe = describeComparison;
  suggestName = suggestComparisonName;

  /** A share link leaves out each home's income and debts. */
  override readonly shareNote = msg('Your income and debts are left out.');

  /**
   * Shows homes compared (saved or shared), with the first in the calculator as well: the first home is the
   * calculator's loan. The calculator is unlinked from any purchase it was showing, so Save there starts a new one.
   */
  protected override load(request: HomeComparisonRequest): void {
    super.load(request);
    this.calculator.send(request.homes[0]);
    this.calculator.saved.set(null);
  }

  protected override shareable(request: HomeComparisonRequest): HomeComparisonRequest {
    return { homes: request.homes.map(withoutIncome) };
  }

  /** The first home's loan: the one the calculator shares with the other pages. */
  protected loanOf(request: HomeComparisonRequest): SharedLoan {
    return purchaseLoanOf(request.homes[0]);
  }

  protected send$(request: HomeComparisonRequest) {
    // The comparison shows none of the seller's offer, affordability, or renting: it does not ask for them.
    const plain = request.homes.map((home) => ({ ...home, sellerOffer: null, affordability: null, rentOrBuy: null }));
    return forkJoin(plain.map((home) => this.api.calculate(home))).pipe(map((homes) => ({ homes })));
  }
}
