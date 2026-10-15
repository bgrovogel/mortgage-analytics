import { AmortizationResponse } from '../../../core/models/amortization.models';

/** What a fixed-rate payment is worked out from, read out of a result for the "Show the math" dialog. */
export interface PaymentMath {
  /** What is owed before the first payment on the schedule. */
  balance: number;
  /** The annual rate, in percent. */
  annualRatePercent: number;
  /** The rate for one month, in percent: the annual rate over twelve. */
  monthlyRatePercent: number;
  /** How many payments the schedule has. */
  payments: number;
  /** The principal and interest payment. */
  payment: number;
  /** The first payment's interest (balance times the monthly rate) and what is left of it for principal. */
  firstInterest: number;
  firstPrincipal: number;
  /** True when the last balance is exactly zero. */
  endsAtZero: boolean;
}

/**
 * The standard schedule's payment and its first month, with what they come from. Null for a loan whose rate changes
 * along the way (an adjustable rate, a buydown): each period is worked out the same way, but one formula would mislead.
 */
export function paymentMath(result: AmortizationResponse): PaymentMath | null {
  const schedule = result.baseline;
  const first = schedule.payments[0];
  if (!first || schedule.rateChanges.length > 0 || result.buydown) return null;
  const annualRatePercent = first.annualInterestRate;
  return {
    balance: first.remainingBalance + first.principal + first.extraPrincipal,
    annualRatePercent,
    monthlyRatePercent: annualRatePercent / 12,
    payments: schedule.payments.length,
    payment: schedule.monthlyPayment,
    firstInterest: first.interest,
    firstPrincipal: first.principal,
    endsAtZero: schedule.payments[schedule.payments.length - 1].remainingBalance === 0,
  };
}
