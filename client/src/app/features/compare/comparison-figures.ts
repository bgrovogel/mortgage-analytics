import { AmortizationResponse } from '../../core/models/amortization.models';
import { usd, usdCents } from '../../core/formatting/format';
import { homeName } from '../../core/models/home-comparison.models';
import { msg, t } from '../../core/i18n/i18n';

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
  /** The rate counting the lender's costs and mortgage insurance; null when nothing was received. */
  apr: number | null;
  /** The first payment due, with housing costs: with a buydown, year 1's reduced payment. */
  monthlyPayment: number;
  /** The extra principal paid with the first payment: 0 for none, or one that starts later. */
  extraPrincipal: number;
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
    apr: r.annualPercentageRate ?? null,
    monthlyPayment: firstYear ? principalAndInterest + housingCosts : r.baseline.totalMonthlyPayment,
    extraPrincipal: r.accelerated.payments[0]?.extraPrincipal ?? 0,
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
  // Which of three phrases a difference is: the same, more or less, with its amount.
  const pick = (difference: number, format: (value: number) => string, same: string, more: string, less: string) => {
    const amount = format(Math.abs(difference));
    return amount === format(0) ? t(same) : difference > 0 ? t(more, [amount]) : t(less, [amount]);
  };
  const monthly = b.monthlyPayment - a.monthlyPayment;
  const parts = [pick(monthly, usdCents, msg('costs the same a month'), msg('costs {0} a month more'), msg('costs {0} a month less'))];
  if (a.cashToClose !== null && b.cashToClose !== null) {
    parts.push(pick(b.cashToClose - a.cashToClose, usd, msg('needs the same at closing'), msg('needs {0} more at closing'), msg('needs {0} less at closing')));
  }
  const five = b.fiveYearCost - a.fiveYearCost;
  parts.push(
    usd(Math.abs(five)) === usd(0)
      ? t('costs the same over the first {0} years', [FIRST_YEARS])
      : five > 0
        ? t('costs {0} more over the first {1} years', [usd(Math.abs(five)), FIRST_YEARS])
        : t('costs {0} less over the first {1} years', [usd(Math.abs(five)), FIRST_YEARS]),
  );
  const last = parts.pop()!;
  return t('{0} {1}, and {2}.', [name, parts.join(', '), last]);
}

/** "Home C costs the least over the first 5 years: $7,250 less than Home B, the next.": the cheapest of several homes. */
export function cheapestHome(homes: HomeFigures[]): string {
  const ranked = homes.map((f, i) => ({ name: homeName(i), cost: f.fiveYearCost })).sort((x, y) => x.cost - y.cost);
  if (Math.round(ranked[ranked.length - 1].cost - ranked[0].cost) === 0) return t('All {0} homes cost the same over the first {1} years.', [homes.length, FIRST_YEARS]);
  const [best, next] = ranked;
  const gap = Math.round(next.cost - best.cost);
  const [first, second] = [best, next].map((h) => h.name).sort();
  return gap === 0
    ? t('{0} and {1} cost the least over the first {2} years, the same.', [first, second, FIRST_YEARS])
    : t('{0} costs the least over the first {1} years: {2} less than {3}, the next.', [best.name, FIRST_YEARS, usd(gap), next.name]);
}
