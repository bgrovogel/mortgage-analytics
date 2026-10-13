import { Injectable, inject, signal } from '@angular/core';
import { describeInputs, suggestName } from '../../core/formatting/describe-inputs';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { CalculationStore } from '../../core/state/calculation-store';
import { SharedLoan, sharedRateFrom } from '../../core/state/shared-loan.store';
import { loanToday, toCents } from '../../core/loans/loan-progress';
import { wholeYearsOf } from './loan-form/loan-fields';

export { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';

/** The calculator's state, shared by the form, the result tabs and other pages. */
@Injectable({ providedIn: 'root' })
export class CalculatorStore extends CalculationStore<AmortizationRequest, AmortizationResponse> {
  private readonly api = inject(AmortizationApiService);

  readonly kind = 'Purchase';
  readonly route = ['/calculator', 'overview'];
  readonly pageName = 'Calculator';

  /** Whether the headline numbers are on screen; when they are not, phones show a compact summary bar. */
  readonly headlineVisible = signal(false);

  describe = describeInputs;
  suggestName = suggestName;

  /**
   * The loan as it stands today. A new loan (first payment still ahead) is the price less the down payment, over
   * the whole term. A loan already being paid shares what is owed now, the payments left, the home's value now,
   * and how it started.
   */
  protected loanOf(request: AmortizationRequest): SharedLoan {
    const today = this.today(request);
    return {
      balance: today.balance,
      annualInterestRate: request.annualInterestRate,
      remainingTermInMonths: today.monthsLeft,
      homeValue: today.homeValue,
      start: today.made > 0 && request.firstPaymentDate
        ? { amount: toCents(request.homePrice - request.downPayment), termInMonths: request.termInMonths, firstPaymentDate: request.firstPaymentDate }
        : null,
      // An ARM's fixed period counts from the first payment here; shared, it counts from today.
      rate: sharedRateFrom(request.buydown, request.adjustableRate, today.made),
      monthlyPmi: monthlyPmiOf(request),
    };
  }

  /**
   * True when the calculator holds the shared loan as closely as it can: the same balance (to the dollar, since a
   * loan already being paid is worked out backwards), the same rate, and the term the loan form gave it, in whole
   * years. The home's value only counts for a new loan, whose price it is; a loan already being paid keeps its
   * own purchase price.
   */
  protected override matchesShared(request: AmortizationRequest, shared: SharedLoan): boolean {
    const today = this.today(request);
    if (!this.rateMatches(sharedRateFrom(request.buydown, request.adjustableRate, today.made), shared.rate ?? null)) return false;
    if (shared.start) {
      // The loan as it started: the calculator holds it exactly, but for a term in whole years.
      return request.firstPaymentDate === shared.start.firstPaymentDate
        && toCents(request.homePrice - request.downPayment) === shared.start.amount
        && request.annualInterestRate === shared.annualInterestRate
        && request.termInMonths === wholeYearsOf(shared.start.termInMonths) * 12;
    }
    return Math.abs(today.balance - shared.balance) < 1
      && request.annualInterestRate === shared.annualInterestRate
      && request.termInMonths === wholeYearsOf(today.made + shared.remainingTermInMonths) * 12
      && (today.made > 0 || shared.homeValue === null || request.homePrice === Math.max(shared.homeValue, shared.balance));
  }

  private today(request: AmortizationRequest) {
    return loanToday({ ...request, homeValueGrowthRate: request.housingCosts?.homeValueGrowthRate }, new Date());
  }

  protected send$(request: AmortizationRequest) {
    return this.api.calculate(request);
  }
}

/**
 * The PMI a conventional loan charges each month: the yearly rate on the loan borrowed, when that is more than 80% of
 * the price; 0 otherwise. Null for an FHA or VA loan, whose mortgage insurance is not PMI and does not end at 80%.
 */
export function monthlyPmiOf(request: AmortizationRequest): number | null {
  if (request.program && request.program.type !== 'Conventional') return null;
  const loan = request.homePrice - request.downPayment;
  const rate = request.housingCosts?.pmiRate ?? 0;
  return loan > request.homePrice * 0.8 && rate > 0 ? toCents((loan * rate) / 100 / 12) : 0;
}
