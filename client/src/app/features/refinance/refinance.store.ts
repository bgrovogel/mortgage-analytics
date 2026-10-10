import { Injectable, inject } from '@angular/core';
import { describeRefinance, suggestRefinanceName } from '../../core/formatting/describe-inputs';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { CalculationStore } from '../../core/state/calculation-store';
import { SharedLoan } from '../../core/state/shared-loan.store';

/** The refinance comparison's state. */
@Injectable({ providedIn: 'root' })
export class RefinanceStore extends CalculationStore<RefinanceRequest, RefinanceResponse> {
  private readonly api = inject(RefinanceApiService);

  readonly kind = 'Refinance';
  readonly route = ['/refinance'];
  readonly pageName = 'Refinance';

  describe = describeRefinance;
  suggestName = suggestRefinanceName;

  /** The loan today (the one being refinanced), and how it started when given. The page does not ask for the home's value. */
  protected loanOf(request: RefinanceRequest): SharedLoan {
    return {
      balance: request.currentBalance,
      annualInterestRate: request.currentAnnualInterestRate,
      remainingTermInMonths: request.remainingTermInMonths,
      homeValue: null,
      start: request.originalLoan ?? null,
    };
  }

  protected send$(request: RefinanceRequest) {
    return this.api.analyze(request);
  }
}
