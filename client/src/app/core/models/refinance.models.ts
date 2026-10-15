/** TypeScript mirrors of the refinance contracts (MortgageAnalytics.Application.Contracts). */
import { AdjustableRateInput, BuydownSummary, RateChange, TemporaryBuydownInput } from './amortization.models';

/** A loan as it was taken out (mirrors OriginalLoanRequest). */
export interface OriginalLoan {
  amount: number;
  termInMonths: number;
  firstPaymentDate: string; // ISO date, yyyy-MM-dd
}

export interface RefinanceRequest {
  /** Ignored by the API when originalLoan is given: it works out what is owed from that loan's own schedule. */
  currentBalance: number;
  currentAnnualInterestRate: number;
  remainingTermInMonths: number;
  nextPaymentDate: string | null; // ISO date, yyyy-MM-dd
  newAnnualInterestRate: number;
  newTermInMonths: number;
  closingCosts: number;
  financeClosingCosts: boolean;
  /** Cash taken out of the home's equity at closing, borrowed on top of the balance; 0 or left out for none. */
  cashOut?: number;
  /** The current loan as it was taken out, when known. */
  originalLoan?: OriginalLoan | null;
  /** The current loan's rate adjusts (its fixed period counts from the next payment, or from the original first one). */
  currentAdjustableRate?: AdjustableRateInput | null;
  /** The new loan's rate adjusts. */
  newAdjustableRate?: AdjustableRateInput | null;
  /** A temporary buydown on the new loan, paid for at closing. */
  newBuydown?: TemporaryBuydownInput | null;
  /** What the home is worth today; with it, each loan carries PMI while above 80% of it. Null leaves PMI out. */
  homeValue?: number | null;
  /** The PMI on the current loan's statement each month; 0 for none. */
  currentMonthlyPmi?: number;
  /** The new loan's yearly PMI rate, should it be above 80% of the value. */
  newPmiRate?: number;
}

/** One payment on a loan, without housing costs. */
export interface LoanPayment {
  paymentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  extraPrincipal: number;
  remainingBalance: number;
}

/** One way of repaying: keep the current loan, refinance, or refinance and keep paying today's amount. */
export interface RefinanceOption {
  loanAmount: number;
  monthlyPayment: number;
  extraMonthlyPrincipal: number;
  numberOfPayments: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: string;
  payments: LoanPayment[];
  rateChanges: RateChange[];
  /** The PMI with the first payment; 0 without any. */
  monthlyPmi: number;
  /** All the PMI paid. */
  totalPmi: number;
  /** The last payment with PMI, or null without any. */
  pmiEndDate: string | null;
}

export interface RefinanceResponse {
  current: RefinanceOption;
  refinanced: RefinanceOption;
  keepingCurrentPayment: RefinanceOption | null;
  upfrontCosts: number;
  monthlySavings: number;
  interestSaved: number;
  lifetimeSavings: number;
  keepingCurrentPaymentLifetimeSavings: number | null;
  monthsAdded: number;
  breakEvenPaymentNumber: number | null;
  breakEvenDate: string | null;
  /** What a buydown on the new loan costs at closing (included in upfrontCosts). */
  buydownCost: number;
  newBuydown: BuydownSummary | null;
  /** When either loan adjusts: the lifetime savings if rates rise as far as the caps allow. */
  worstCaseLifetimeSavings: number | null;
  /** The cash taken out at closing; 0 for none. The lifetime savings count it as money in hand. */
  cashOut: number;
  /** The cash in hand after closing: the cash out less what is paid at closing. */
  netCash: number;
  /** The new loan as a percentage of the home's value; null without a home value. */
  newLoanToValuePercent: number | null;
  /** Cash is taken out and the new loan is above the 80% of the home's value that a cash-out refinance allows. */
  exceedsCashOutLimit: boolean;
}
