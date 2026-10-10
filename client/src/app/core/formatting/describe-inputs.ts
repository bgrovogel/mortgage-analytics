import { AmortizationRequest } from '../models/amortization.models';
import { RefinanceRequest } from '../models/refinance.models';
import { StrategyRequest } from '../models/strategy.models';
import { decimal, usd } from './format';


const downPaymentPercent = (r: AmortizationRequest) => (r.homePrice > 0 ? (r.downPayment / r.homePrice) * 100 : 0);

/** "$375,000 home · 5% down · 6.5% · 30 yr · $200/mo extra": enough to tell saved calculations apart. */
export function describeInputs(r: AmortizationRequest): string {
  const term = termOf(r.termInMonths);
  const extra = r.extraPayments?.monthlyAmount ? `${usd(r.extraPayments.monthlyAmount)}/mo extra` : null;
  return [
    `${usd(r.homePrice)} home`,
    `${decimal(downPaymentPercent(r), 1)}% down`,
    `${decimal(r.annualInterestRate)}%`,
    term,
    extra,
  ].filter(Boolean).join(' · ');
}

/** A starting name for a new saved calculation, e.g. "$375,000 home, 20% down at 6.25%". */
export function suggestName(r: AmortizationRequest): string {
  return `${usd(r.homePrice)} home, ${decimal(downPaymentPercent(r), 1)}% down at ${decimal(r.annualInterestRate)}%`;
}

/** "$300,000 left at 7% → 6% · 30 yr · $6,000 closing costs". */
export function describeRefinance(r: RefinanceRequest): string {
  const closing = `${usd(r.closingCosts)} closing costs${r.financeClosingCosts ? ' in the loan' : ''}`;
  return [
    `${usd(r.currentBalance)} left at ${decimal(r.currentAnnualInterestRate)}% → ${decimal(r.newAnnualInterestRate)}%`,
    termOf(r.newTermInMonths),
    closing,
  ].join(' · ');
}

/** A starting name for a saved refinance comparison, e.g. "Refinance 7% → 6%, 30 yr". */
export function suggestRefinanceName(r: RefinanceRequest): string {
  return `Refinance ${decimal(r.currentAnnualInterestRate)}% → ${decimal(r.newAnnualInterestRate)}%, ${termOf(r.newTermInMonths)}`;
}

/** "$300,000 left at 6.5% · $1,000/mo to put to work · Balanced": enough to tell saved strategy comparisons apart. */
export function describeStrategy(r: StrategyRequest): string {
  return [
    `${usd(r.currentBalance)} left at ${decimal(r.annualInterestRate)}%`,
    `${usd(r.monthlyCashToPutToWork)}/mo to put to work`,
    r.riskProfile,
  ].join(' · ');
}

/** A starting name for a saved strategy comparison, e.g. "Pay off or invest: $1,000/mo, 6.5% mortgage". */
export function suggestStrategyName(r: StrategyRequest): string {
  return `Pay off or invest: ${usd(r.monthlyCashToPutToWork)}/mo, ${decimal(r.annualInterestRate)}% mortgage`;
}

/** 360 becomes "30 yr"; 100 becomes "100 mo". */
function termOf(months: number): string {
  return months % 12 === 0 ? `${months / 12} yr` : `${months} mo`;
}
