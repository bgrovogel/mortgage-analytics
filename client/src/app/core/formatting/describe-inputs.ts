import { AmortizationRequest } from '../models/amortization.models';
import { HomeComparisonRequest } from '../models/home-comparison.models';
import { RefinanceRequest } from '../models/refinance.models';
import { StrategyRequest } from '../models/strategy.models';
import { monthlyPayment } from '../loans/loan-progress';
import { decimal, usd, usdCents } from './format';
import { t } from '../i18n/i18n';

const downPaymentPercent = (r: AmortizationRequest) => (r.homePrice > 0 ? (r.downPayment / r.homePrice) * 100 : 0);

/** "$375,000 home · 5% down · 6.5% · 30 yr · $200/mo extra": enough to tell saved calculations apart. */
export function describeInputs(r: AmortizationRequest): string {
  const term = termOf(r.termInMonths);
  const extra = r.extraPayments?.monthlyAmount ? t('{0}/mo extra', [usd(r.extraPayments.monthlyAmount)]) : null;
  return [
    t('{0} home', [usd(r.homePrice)]),
    t('{0}% down', [decimal(downPaymentPercent(r), 1)]),
    `${decimal(r.annualInterestRate)}%`,
    term,
    rateTypeOf(r),
    extra,
  ].filter(Boolean).join(' · ');
}

/**
 * The figure a saved purchase's card leads with: the principal and interest it comes to, from its own numbers. Null where
 * they do not say it: an FHA or VA loan borrows an upfront premium the numbers do not hold, and an adjustable rate or a
 * buydown has no one payment.
 */
export function purchaseFigure(r: AmortizationRequest): string | null {
  if ((r.program && r.program.type !== 'Conventional') || r.adjustableRate || r.buydown) return null;
  const payment = monthlyPayment(r.homePrice - r.downPayment, r.annualInterestRate, r.termInMonths);
  return payment > 0 ? t('{0} a month, principal and interest', [usdCents(payment)]) : null;
}

/** The new payment of a saved refinance, on the balance plus any cash out and financed costs; null from an original loan. */
export function refinanceFigure(r: RefinanceRequest): string | null {
  if (r.originalLoan || r.newAdjustableRate || r.newBuydown) return null;
  const borrowed = r.currentBalance + (r.cashOut ?? 0) + (r.financeClosingCosts ? r.closingCosts : 0);
  const payment = monthlyPayment(borrowed, r.newAnnualInterestRate, r.newTermInMonths);
  return payment > 0 ? t('{0} a month on the new loan, principal and interest', [usdCents(payment)]) : null;
}

/** A starting name for a new saved calculation, e.g. "$375,000 home, 20% down at 6.25%". */
export function suggestName(r: AmortizationRequest): string {
  return t('{0} home, {1}% down at {2}%', [usd(r.homePrice), decimal(downPaymentPercent(r), 1), decimal(r.annualInterestRate)]);
}

/** "$415,000 home, 9% down at 6.25% vs $450,000 home, 20% down at 6%": the price, down payment and rate of each. */
export function describeComparison(r: HomeComparisonRequest): string {
  return r.homes.map(suggestName).join(t(' vs '));
}

/** A starting name for a saved comparison, e.g. "$415,000 or $450,000 home", or "$415,000, $450,000 or $380,000 home". */
export function suggestComparisonName(r: HomeComparisonRequest): string {
  const prices = r.homes.map((home) => usd(home.homePrice));
  return t('{0} or {1} home', [prices.slice(0, -1).join(', '), prices[prices.length - 1]]);
}

/** "$300,000 left at 7% → 6% · 30 yr · $6,000 closing costs", with "· $50,000 cash out" before the costs when cash is taken. */
export function describeRefinance(r: RefinanceRequest): string {
  const closing = r.financeClosingCosts ? t('{0} closing costs in the loan', [usd(r.closingCosts)]) : t('{0} closing costs', [usd(r.closingCosts)]);
  return [
    t('{0} left at {1}% → {2}%', [usd(r.currentBalance), decimal(r.currentAnnualInterestRate), decimal(r.newAnnualInterestRate)]),
    termOf(r.newTermInMonths),
    ...(r.cashOut ? [t('{0} cash out', [usd(r.cashOut)])] : []),
    closing,
  ].join(' · ');
}

/** A starting name for a saved refinance comparison, e.g. "Refinance 7% → 6%, 30 yr". */
export function suggestRefinanceName(r: RefinanceRequest): string {
  return t('Refinance {0}% → {1}%, {2}', [decimal(r.currentAnnualInterestRate), decimal(r.newAnnualInterestRate), termOf(r.newTermInMonths)]);
}

/** "$300,000 left at 6.5% · $1,000/mo to put to work · Balanced": enough to tell saved strategy comparisons apart. */
export function describeStrategy(r: StrategyRequest): string {
  return [
    t('{0} left at {1}%', [usd(r.currentBalance), decimal(r.annualInterestRate)]),
    t('{0}/mo to put to work', [usd(r.monthlyCashToPutToWork)]),
    t(r.riskProfile),
  ].join(' · ');
}

/** A starting name for a saved strategy comparison, e.g. "Pay off or invest: $1,000/mo, 6.5% mortgage". */
export function suggestStrategyName(r: StrategyRequest): string {
  return t('Pay off or invest: {0}/mo, {1}% mortgage', [usd(r.monthlyCashToPutToWork), decimal(r.annualInterestRate)]);
}

/** "2-1 buydown" or "7/1 ARM", or null for a fixed rate. */
function rateTypeOf(r: AmortizationRequest): string | null {
  if (r.buydown) return t('{0} buydown', [r.buydown.yearlyReductions.join('-')]);
  if (r.adjustableRate) {
    const a = r.adjustableRate;
    const fixed = a.initialFixedMonths % 12 === 0 ? a.initialFixedMonths / 12 : t('{0} mo', [a.initialFixedMonths]);
    return t('{0}/{1} ARM', [fixed, a.adjustmentIntervalMonths === 12 ? 1 : a.adjustmentIntervalMonths]);
  }
  return null;
}

/** 360 becomes "30 yr"; 100 becomes "100 mo". */
function termOf(months: number): string {
  return months % 12 === 0 ? t('{0} yr', [months / 12]) : t('{0} mo', [months]);
}
