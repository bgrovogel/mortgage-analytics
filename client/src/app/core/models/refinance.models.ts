/** TypeScript mirrors of the refinance contracts (MortgageAnalytics.Application.Contracts). */
import { AdjustableRateInput, BuydownSummary, DiscountPointsInput, RateChange, TemporaryBuydownInput } from './amortization.models';

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
  /** A debt the cash out pays off, to compare with keeping it. Needs cashOut of at least its balance. */
  debtPayoff?: DebtPayoffInput | null;
  /** Discount points bought on the new loan, whose rate is then the rate with them. Only for a fixed rate. */
  newDiscountPoints?: DiscountPointsInput | null;
  /** A home-equity loan for the cash out, to compare with refinancing to take it out. Needs cashOut. */
  homeEquityLoan?: HomeEquityLoan | null;
}

/** A debt paid on its own with a fixed payment until it is gone (mirrors DebtPayoffRequest). */
export interface DebtPayoffInput {
  balance: number;
  annualInterestRate: number;
  monthlyPayment: number;
  /** The years both ways are costed over, 1 to 30. */
  yearsKept: number;
}

/** A fixed-rate home-equity loan:: a fixed-rate home-equity loan, or, with a draw
 * period, a line of credit that is drawn at once, pays only interest while drawn, then is repaid over its term.
 */
export interface HomeEquityLoan {
  /** A loan's rate; a line's rate while it is drawn. */
  annualInterestRate: number;
  /** A loan's term; the months a line is repaid over once the draw period ends. */
  termInMonths: number;
  /** For a line of credit: the months it is drawn, interest only. Absent (or 0) for a loan. */
  drawPeriodInMonths?: number;
  /** For a line of credit: the rate expected once repayment begins. Absent keeps annualInterestRate. */
  repaymentRate?: number | null;
  /** The years both ways are costed over, 1 to 30. */
  yearsKept: number;
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
  /** The home-equity loan compared with the cash-out refinance, when the request asked for it. */
  homeEquity?: HomeEquityComparison | null;
  /** What the new loan's discount points are worth against the rate without them, when the request bought some. */
  points?: RefinancePoints | null;
  /** Paying off a debt with the cash out, compared with keeping it, when the request asked. */
  debtPayoff?: DebtPayoff | null;
}

/** Paying off a debt with the cash out, against keeping it, each costed over the years kept. */
export interface DebtPayoff {
  balance: number;
  annualInterestRate: number;
  monthlyPayment: number;
  yearsKept: number;
  /** How many payments the debt takes at its payment. */
  monthsToPayOff: number;
  /** All the interest the debt would charge. */
  totalInterest: number;
  keepDebt: DebtPayoffOption;
  payItOff: DebtPayoffOption;
  /** What paying it off saves; negative when it costs more. */
  savedByPayingOff: number;
  /** How much less is paid each month while the debt would last; negative when more. */
  monthlyChange: number;
}

/** One way of dealing with the debt, costed over the years kept. */
export interface DebtPayoffOption {
  monthlyPayment: number;
  payments: number;
  stillOwed: number;
  cost: number;
}

/** Whether the new loan's points pay: two loans of the same size, the points paid at closing, at the rate with them and without. */
export interface RefinancePoints {
  points: number;
  cost: number;
  rateWithPoints: number;
  rateWithoutPoints: number;
  paymentWithPoints: number;
  paymentWithoutPoints: number;
  monthlySaving: number;
  interestSaved: number;
  /** The interest saved, less what the points cost; negative when they lose money. */
  netSaving: number;
  /** The payment by which the interest saved covers the cost, or null when it never does. */
  breakEvenPayment: number | null;
  breakEvenDate: string | null;
}

/** Taking the cash out as a home-equity loan beside the current loan, against refinancing to take it out. */
export interface HomeEquityComparison {
  amount: number;
  annualInterestRate: number;
  termInMonths: number;
  yearsKept: number;
  /** What could be borrowed against the home: 80% of its value less what is owed; null without a home value. */
  availableEquity: number | null;
  /** What is owed plus the cash, as a percentage of the home's value; null without a home value. */
  combinedLoanToValuePercent: number | null;
  exceedsLimit: boolean;
  keepAndBorrow: HomeEquityOption;
  cashOutRefinance: HomeEquityOption;
  /** What the home-equity loan saves against the refinance; negative when it costs more. */
  savedByEquityLoan: number;
  /** The months a line of credit is drawn, interest only; 0 for a loan. */
  drawPeriodInMonths: number;
  /** The rate it is repaid at: a loan's rate, or the rate expected once a line's repayment begins. */
  repaymentRate: number;
  /** Its monthly payment once repaid: a loan's from the start, a line's after the draw period. */
  repaymentPayment: number;
}

/** One way of getting the cash, costed over the years kept. */
export interface HomeEquityOption {
  monthlyPayment: number;
  equityLoanPayment: number;
  payments: number;
  stillOwed: number;
  upfrontCosts: number;
  cost: number;
}
