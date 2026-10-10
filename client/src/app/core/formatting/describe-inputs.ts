import { AmortizationRequest } from '../models/amortization.models';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const downPaymentPercent = (r: AmortizationRequest) => (r.homePrice > 0 ? (r.downPayment / r.homePrice) * 100 : 0);

/** "$375,000 home · 5% down · 6.5% · 30 yr · $200/mo extra": enough to tell saved calculations apart. */
export function describeInputs(r: AmortizationRequest): string {
  const term = r.termInMonths % 12 === 0 ? `${r.termInMonths / 12} yr` : `${r.termInMonths} mo`;
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
