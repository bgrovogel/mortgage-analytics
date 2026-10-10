/** TypeScript mirrors of the refinance contracts (MortgageAnalytics.Application.Contracts). */

export interface RefinanceRequest {
  currentBalance: number;
  currentAnnualInterestRate: number;
  remainingTermInMonths: number;
  nextPaymentDate: string | null; // ISO date, yyyy-MM-dd
  newAnnualInterestRate: number;
  newTermInMonths: number;
  closingCosts: number;
  financeClosingCosts: boolean;
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
