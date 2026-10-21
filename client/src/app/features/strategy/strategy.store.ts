import { Injectable, inject } from '@angular/core';
import { describeStrategy, suggestStrategyName } from '../../core/formatting/describe-inputs';
import { StrategyComparison, StrategyRequest } from '../../core/models/strategy.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { CalculationStore } from '../../core/state/calculation-store';
import { SharedLoan, sharedRateFrom } from '../../core/state/shared-loan.store';
import { msg, t } from '../../core/i18n/i18n';

/** The pay-off-or-invest comparison's state. */
@Injectable({ providedIn: 'root' })
export class StrategyStore extends CalculationStore<StrategyRequest, StrategyComparison> {
  private readonly api = inject(StrategyApiService);

  readonly kind = 'Strategy';
  readonly route = ['/strategy'];
  get pageName(): string {
    return t('Pay off or invest');
  }

  describe = describeStrategy;
  suggestName = suggestStrategyName;

  /** The comparison needs the household's income and savings, so a share link carries them. */
  override readonly shareNote = msg('It includes your income and savings.');

  protected loanOf(request: StrategyRequest): SharedLoan {
    return {
      balance: request.currentBalance,
      annualInterestRate: request.annualInterestRate,
      remainingTermInMonths: request.remainingTermInMonths,
      homeValue: request.homeValue,
      rate: sharedRateFrom(request.buydown, request.adjustableRate),
      monthlyPmi: request.monthlyPmi ?? 0,
    };
  }

  protected send$(request: StrategyRequest) {
    return this.api.compare(request);
  }
}
