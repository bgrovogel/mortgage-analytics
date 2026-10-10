import { AmortizationRequest } from '../models/amortization.models';
import { RefinanceRequest } from '../models/refinance.models';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const downPaymentPercent = (r: AmortizationRequest) => (r.homePrice > 0 ? (r.downPayment / r.homePrice) * 100 : 0);

/** "$375,000 home · 5% down · 6.5% · 30 yr · $200/mo extra": enough to tell saved calculations apart. */
export function describeInputs(r: AmortizationRequest): string {
  const term = termOf(r.termInMonths);
  const extra = r.extraPayments?.monthlyAmount ? `${dollars.format(r.extraPayments.monthlyAmount)}/mo extra` : null;
  return [
    `${dollars.format(r.homePrice)} home`,
    `${oneDecimal.format(downPaymentPercent(r))}% down`,
    `${number.format(r.annualInterestRate)}%`,
    term,
    extra,
  ].filter(Boolean).join(' · ');
}

/** A starting name for a new saved calculation, e.g. "$375,000 home, 20% down at 6.25%". */
export function suggestName(r: AmortizationRequest): string {
  return `${dollars.format(r.homePrice)} home, ${oneDecimal.format(downPaymentPercent(r))}% down at ${number.format(r.annualInterestRate)}%`;
}

/** "$300,000 left at 7% → 6% · 30 yr · $6,000 closing costs". */
export function describeRefinance(r: RefinanceRequest): string {
  const closing = `${dollars.format(r.closingCosts)} closing costs${r.financeClosingCosts ? ' in the loan' : ''}`;
  return [
    `${dollars.format(r.currentBalance)} left at ${number.format(r.currentAnnualInterestRate)}% → ${number.format(r.newAnnualInterestRate)}%`,
    termOf(r.newTermInMonths),
    closing,
  ].join(' · ');
}

/** A starting name for a saved refinance comparison, e.g. "Refinance 7% → 6%, 30 yr". */
export function suggestRefinanceName(r: RefinanceRequest): string {
  return `Refinance ${number.format(r.currentAnnualInterestRate)}% → ${number.format(r.newAnnualInterestRate)}%, ${termOf(r.newTermInMonths)}`;
}

/** 360 becomes "30 yr"; 100 becomes "100 mo". */
function termOf(months: number): string {
  return months % 12 === 0 ? `${months / 12} yr` : `${months} mo`;
}
