import { Injectable, inject } from '@angular/core';
import { describeRefinance, suggestRefinanceName } from '../../core/formatting/describe-inputs';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { CalculationStore } from '../../core/state/calculation-store';
import { paymentsMade } from '../../core/loans/loan-progress';
import { SharedLoan, sharedRateFrom } from '../../core/state/shared-loan.store';
import { t } from '../../core/i18n/i18n';

/** The refinance comparison's state. */
@Injectable({ providedIn: 'root' })
export class RefinanceStore extends CalculationStore<RefinanceRequest, RefinanceResponse> {
  private readonly api = inject(RefinanceApiService);

  readonly kind = 'Refinance';
  readonly route = ['/refinance'];
  get pageName(): string {
    return t('Refinance');
  }

  describe = describeRefinance;
  suggestName = suggestRefinanceName;

  /** The loan today (the one being refinanced), how it started when given, the home's value and today's PMI. */
  protected loanOf(request: RefinanceRequest): SharedLoan {
    return {
      balance: request.currentBalance,
      annualInterestRate: request.currentAnnualInterestRate,
      remainingTermInMonths: request.remainingTermInMonths,
      homeValue: request.homeValue ?? null,
      monthlyPmi: request.homeValue == null ? null : (request.currentMonthlyPmi ?? 0),
      start: request.originalLoan ?? null,
      // The current loan's ARM counts from the next payment, or from the original first one when that is given.
      rate: sharedRateFrom(null, request.currentAdjustableRate, request.originalLoan ? paymentsMade(request.originalLoan.firstPaymentDate, new Date()) : 0),
    };
  }

  /** The current loan has no buydown option: a shared buydown shows here as fixed, and stays shared. */
  protected override readonly holdsBuydowns = false;

  protected send$(request: RefinanceRequest) {
    return this.api.analyze(request);
  }
}
