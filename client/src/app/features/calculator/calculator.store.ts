import { Injectable, inject, signal } from '@angular/core';
import { describeInputs, suggestName } from '../../core/formatting/describe-inputs';
import { AmortizationRequest, AmortizationResponse, RentOrBuyInput, SellerOfferInput } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { CalculationStore } from '../../core/state/calculation-store';
import { SharedLoan, sharedRateFrom } from '../../core/state/shared-loan.store';
import { loanToday, toCents } from '../../core/loans/loan-progress';
import { wholeYearsOf } from './loan-form/loan-fields';

export { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';

/** The seller's offer is weighed over seven years, the usual time a loan is kept, with a quarter point off per point. */
export const DEFAULT_OFFER_SETTINGS: SellerOfferInput = { yearsKept: 7, rateCutPerPoint: 0.25 };

/** The calculator's state, shared by the form, the result tabs and other pages. */
@Injectable({ providedIn: 'root' })
export class CalculatorStore extends CalculationStore<AmortizationRequest, AmortizationResponse> {
  private readonly api = inject(AmortizationApiService);

  readonly kind = 'Purchase';
  readonly route = ['/calculator', 'overview'];
  readonly pageName = 'Calculator';

  /** What the affordability question starts from: a home in mind, or the budget (the most that could be bought). */
  readonly affordStart = signal<'home' | 'budget'>('home');

  /** Whether the headline numbers are on screen; when they are not, phones show a compact summary bar. */
  readonly headlineVisible = signal(false);

  /**
   * How the seller's money is weighed: over how many years, and what each point takes off the rate. They are set
   * beside the comparison they change, not in the form, so every request gets them here.
   */
  readonly offerSettings = signal<SellerOfferInput>(DEFAULT_OFFER_SETTINGS);

  /**
   * Renting a similar home, to weigh buying against: set on the Rent or buy tab, beside the answer, rather than in the
   * form. Null until a rent is given.
   */
  readonly rentSettings = signal<RentOrBuyInput | null>(null);

  /**
   * Queues a request with the settings the tabs keep: how the seller's offer is weighed, and the rent to weigh buying
   * against. A request that brings its own (a saved one) sets them instead.
   */
  override send(request: AmortizationRequest): void {
    if (request.sellerOffer) this.offerSettings.set(request.sellerOffer);
    if (request.rentOrBuy) this.rentSettings.set(request.rentOrBuy);
    super.send(this.withSettings(request));
  }

  /** Weighs the seller's offer another way, and calculates again. */
  setOfferSettings(settings: SellerOfferInput): void {
    this.offerSettings.set(settings);
    this.resend();
  }

  /** Weighs buying against renting at another rent (or none), and calculates again. */
  setRentSettings(settings: RentOrBuyInput | null): void {
    this.rentSettings.set(settings);
    this.resend();
  }

  private withSettings(request: AmortizationRequest): AmortizationRequest {
    return { ...request, sellerOffer: this.offerSettings(), rentOrBuy: this.rentSettings() };
  }

  /** Sends the current request again with the settings as they are now, once there is one. */
  private resend(): void {
    const request = this.request();
    if (request) super.send(this.withSettings(request));
  }

  describe = describeInputs;
  suggestName = suggestName;

  /** A share link leaves out the household's income and debts. */
  override readonly shareNote = 'Your income and debts are left out.';

  protected override shareable(request: AmortizationRequest): AmortizationRequest {
    return withoutIncome(request);
  }

  protected loanOf(request: AmortizationRequest): SharedLoan {
    return purchaseLoanOf(request);
  }

  /**
   * True when the calculator holds the shared loan as closely as it can: the same balance (to the dollar, since a
   * loan already being paid is worked out backwards), the same rate, and the term the loan form gave it, in whole
   * years. The home's value only counts for a new loan, whose price it is; a loan already being paid keeps its
   * own purchase price.
   */
  protected override matchesShared(request: AmortizationRequest, shared: SharedLoan): boolean {
    const today = todayOf(request);
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

  protected send$(request: AmortizationRequest) {
    return this.api.calculate(request);
  }
}

/**
 * A purchase's loan as it stands today. A new loan (first payment still ahead) is the price less the down payment,
 * over the whole term. A loan already being paid shares what is owed now, the payments left, the home's value now,
 * and how it started.
 */
export function purchaseLoanOf(request: AmortizationRequest): SharedLoan {
  const today = todayOf(request);
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

/** A purchase without the household's income and debts: what a share link carries. */
export function withoutIncome(request: AmortizationRequest): AmortizationRequest {
  return { ...request, affordability: null };
}

function todayOf(request: AmortizationRequest) {
  return loanToday({ ...request, homeValueGrowthRate: request.housingCosts?.homeValueGrowthRate }, new Date());
}

/**
 * The PMI a conventional loan charges each month: the yearly rate on the loan borrowed, when that is more than 80% of
 * the price; 0 otherwise. Null for an FHA or VA loan, whose mortgage insurance is not PMI and does not end at 80%.
 */
export function monthlyPmiOf(request: AmortizationRequest): number | null {
  if (request.program && request.program.type !== 'Conventional') return null;
  const loan = request.homePrice - request.downPayment;
  return loan > request.homePrice * 0.8 ? toCents((loan * (request.housingCosts?.pmiRate ?? 0)) / 100 / 12) : 0;
}
