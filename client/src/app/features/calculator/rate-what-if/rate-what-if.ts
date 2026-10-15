import { monthlyPayment } from '../../../core/loans/loan-progress';
import { AmortizationResponse } from '../../../core/models/amortization.models';

/** A fixed-rate loan, described by what is borrowed, its yearly rate (percent) and its term in months. */
export interface RateWhatIfLoan {
  amount: number;
  rate: number;
  termMonths: number;
}

/** What the loan would cost at a different rate, against what it costs now. */
export interface WhatIf {
  rate: number;
  /** The monthly principal and interest at that rate. */
  payment: number;
  paymentChange: number;
  /** The interest over the whole loan, paid on schedule. */
  interest: number;
  interestChange: number;
}

const toCents = (value: number) => Math.round(value * 100) / 100;

/** The loan at `delta` percentage points above (or below) its rate, never under nothing. */
export function whatIf(loan: RateWhatIfLoan, delta: number): WhatIf {
  const cost = (rate: number) => {
    const payment = monthlyPayment(loan.amount, rate, loan.termMonths);
    return { payment, interest: toCents(payment * loan.termMonths - loan.amount) };
  };
  const now = cost(loan.rate);
  const rate = Math.max(0, toCents((loan.rate + delta) * 100) / 100);
  const then = cost(rate);
  return {
    rate,
    payment: then.payment,
    paymentChange: toCents(then.payment - now.payment),
    interest: then.interest,
    interestChange: toCents(then.interest - now.interest),
  };
}

/**
 * The loan to price at other rates, or null when one rate does not describe it: a buydown or an adjustable rate
 * changes the rate along the way, and nothing is borrowed on a loan with no principal.
 */
export function rateWhatIfLoan(result: AmortizationResponse): RateWhatIfLoan | null {
  const amount = result.purchase.loanAmount;
  const first = result.baseline.payments[0];
  if (result.buydown || result.adjustableRate || amount <= 0 || !first) return null;
  return { amount, rate: first.annualInterestRate, termMonths: result.baseline.payments.length };
}
