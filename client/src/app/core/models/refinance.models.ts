/** TypeScript mirrors of the refinance contracts (MortgageAnalytics.Application.Contracts). */

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
  /** The current loan as it was taken out, when known. */
  originalLoan?: OriginalLoan | null;
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
}
