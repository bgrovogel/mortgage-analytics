import { AmortizationResponse } from '../../../core/models/amortization.models';
import { usd, usdCents } from '../../../core/formatting/format';
import { homeName } from '../../../core/models/home-comparison.models';

/** How many years the "first years" figures cover. */
export const FIRST_YEARS = 5;

/** What two homes are compared by: one home's figures, read from its calculator results. */
export interface HomeFigures {
  homePrice: number;
  downPayment: number;
  downPaymentPercent: number;
  /** What is borrowed, with any upfront fee added to the loan. */
  loanAmount: number;
  /** The rate on the first payment (a buydown's or an ARM's starting rate). */
  rate: number;
  /** The first payment due, with housing costs: with a buydown, year 1's reduced payment. */
  monthlyPayment: number;
  principalAndInterest: number;
  housingCosts: number;
  /** Null for a loan already being paid, which closed long ago. */
  cashToClose: number | null;
  /** When the mortgage insurance ends on the plan with extra payments; null when there is none. */
  insuranceEnds: string | null;
  paidOff: string;
  /** The interest paid over the loan, on the plan with extra payments (less any buydown subsidy). */
  interest: number;
  /**
   * What the first five years cost that does not build equity: interest, taxes, insurance, mortgage insurance and
   * dues, plus the closing costs (after credits). The escrow deposit and the first year's insurance at closing are
   * left out: they prepay housing costs already counted month by month.
   */
  fiveYearCost: number;
  /** The home's value less what is owed, five years in. */
  equityAfterFiveYears: number;
}

export function figuresOf(r: AmortizationResponse): HomeFigures {
  const firstYear = r.buydown?.years[0];
  const principalAndInterest = firstYear ? firstYear.monthlyPayment : r.baseline.monthlyPayment;
  const housingCosts = r.baseline.monthlyHousingCosts.total;
  const months = r.accelerated.payments.slice(0, FIRST_YEARS * 12);
  const monthly = months.reduce((sum, p) => sum + p.interest - p.buydownSubsidy + p.housingCosts, 0);
  const cash = r.cashToClose;
  const atClosing = cash ? cash.closingCosts - cash.credits - cash.escrowDeposit - cash.homeownersInsurance : 0;
  const projection = r.projection;
  return {
    homePrice: r.purchase.homePrice,
    downPayment: r.purchase.downPayment,
    downPaymentPercent: r.purchase.downPaymentPercent,
    loanAmount: r.purchase.loanAmount,
    rate: r.baseline.payments[0]?.annualInterestRate ?? 0,
    monthlyPayment: firstYear ? principalAndInterest + housingCosts : r.baseline.totalMonthlyPayment,
    principalAndInterest,
    housingCosts,
    cashToClose: cash ? cash.total : null,
    insuranceEnds: r.accelerated.mortgageInsuranceEndDate,
    paidOff: r.savings.acceleratedPayoffDate,
    interest: r.accelerated.interestYouPay,
    fiveYearCost: Math.round((monthly + atClosing) * 100) / 100,
    equityAfterFiveYears: (projection[FIRST_YEARS] ?? projection[projection.length - 1]).equity,
  };
}

/**
 * "Home B costs $357.83 a month more, needs $8,081 more at closing, and costs $11,500 more over the first 5 years.":
 * another home measured against Home A.
 */
export function comparisonHeadline(a: HomeFigures, b: HomeFigures, name = homeName(1)): string {
  const by = (difference: number, format: (value: number) => string, unit = '') =>
    format(Math.abs(difference)) === format(0) ? `the same${unit}` : `${format(Math.abs(difference))}${unit} ${difference > 0 ? 'more' : 'less'}`;
  const parts = [`costs ${by(b.monthlyPayment - a.monthlyPayment, usdCents, ' a month')}`];
  if (a.cashToClose !== null && b.cashToClose !== null) parts.push(`needs ${by(b.cashToClose - a.cashToClose, usd)} at closing`);
  parts.push(`costs ${by(b.fiveYearCost - a.fiveYearCost, usd)} over the first ${FIRST_YEARS} years`);
  const last = parts.pop()!;
  return `${name} ${parts.join(', ')}, and ${last}.`;
}

/** "Home C costs the least over the first 5 years: $7,250 less than Home B, the next.": the cheapest of several homes. */
export function cheapestHome(homes: HomeFigures[]): string {
  const [best, next] = homes.map((f, i) => ({ name: homeName(i), cost: f.fiveYearCost })).sort((x, y) => x.cost - y.cost);
  const gap = Math.round(next.cost - best.cost);
  const [first, second] = [best, next].map((h) => h.name).sort();
  return gap === 0
    ? `${first} and ${second} cost the least over the first ${FIRST_YEARS} years, the same.`
    : `${best.name} costs the least over the first ${FIRST_YEARS} years: ${usd(gap)} less than ${next.name}, the next.`;
}
