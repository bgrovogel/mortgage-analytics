import {
  MarketScenario,
  PayoffStrategy,
  STRATEGIES,
  StrategyComparison,
  StrategyOutcome,
  StrategyProjection,
} from '../../core/models/strategy.models';
import { decimal, monthOf, pct, usd } from '../../core/formatting/format';
import { t } from '../../core/i18n/i18n';

/** "Debt free ASAP". */
export const nameOf = (strategy: PayoffStrategy) => STRATEGIES[strategy].name;

/** The outcome for one strategy. */
export const outcomeOf = (result: StrategyComparison, strategy: PayoffStrategy): StrategyOutcome =>
  result.strategies.find((s) => s.strategy === strategy)!;

/** Net worth after the last year. */
export const finalNetWorth = (projection: StrategyProjection) => projection.years[projection.years.length - 1].netWorth;

/** The banner: the recommended strategy, why it ranks first, and what could reverse it. */
export interface Recommendation {
  headline: string;
  detail: string;
  /** A warning when a bad decade would change the answer; a reassurance when it would not. */
  downside: string;
  /** True when the downside reverses the recommendation. */
  reversible: boolean;
}

/**
 * The recommendation in plain words. It rests on the risk-adjusted return, because the expected return is
 * an average and never guaranteed, and it always says what a lost decade would do.
 */
export function recommendation(result: StrategyComparison): Recommendation {
  const { rates } = result;
  const best = outcomeOf(result, result.recommended);
  const countingOn = rates.riskMargin > 0
    ? t('counting on {0} a year (your {1} less {2} points for risk)', [pct(rates.riskAdjustedReturn), pct(rates.expectedReturn), decimal(rates.riskMargin)])
    : t('counting on your full {0} a year', [pct(rates.expectedReturn)]);
  // A tie goes to the strategy with less risk (paying off first). Investing ties the hybrid only when the hybrid
  // invests everything too: then they are one plan, not two that happen to end level.
  const tie = result.recommended === 'PayOffFirst'
    ? t('Tied with {0} after 30 years, {1}. Paying down debt carries no market risk, so it takes the tie.', [nameOf(result.runnerUp), countingOn])
    : t('{0}, the hybrid invests all your extra cash too, so the two are the same plan.', [`${countingOn[0].toUpperCase()}${countingOn.slice(1)}`]);
  const detail = result.lead > 0 ? t('{0} ahead of {1} after 30 years, {2}.', [usd(result.lead), nameOf(result.runnerUp), countingOn]) : tie;

  const badWinner = result.badDecadeWinner;
  const lostDecade = t('a lost decade ({0} a year, like 2000–2009)', [pct(rates.badDecadeReturn)]);
  if (badWinner !== result.recommended) {
    const margin = finalNetWorth(outcomeOf(result, badWinner).badDecade) - finalNetWorth(best.badDecade);
    return {
      headline: nameOf(result.recommended),
      detail,
      downside: t('Not guaranteed: after {0}, {1} would win by {2}.', [lostDecade, nameOf(badWinner), usd(margin)]),
      reversible: true,
    };
  }
  return { headline: nameOf(result.recommended), detail, downside: t('It stays ahead even after {0}.', [lostDecade]), reversible: false };
}

/**
 * Why the strategies end close together (or far apart). Most of a household's net worth (the home, the 401(k),
 * the savings it already has) is the same whichever strategy it picks; only the extra cash, and the payment once
 * the mortgage is gone, go somewhere different. Without saying so, near-identical totals look wrong.
 */
export function closeness(result: StrategyComparison, scenario: MarketScenario = 'riskAdjusted', todaysDollars = false): string {
  const last = (o: StrategyOutcome) => o[scenario].years[o[scenario].years.length - 1];
  const finals = result.strategies.map((o) => (todaysDollars ? last(o).netWorthInTodaysDollars : last(o).netWorth));
  const best = Math.max(...finals);
  const spread = best - Math.min(...finals);
  const year30 = last(result.strategies[0]);
  // In today's dollars the home is shrunk by the same inflation as net worth (which, holding the paid-off home, is never 0).
  const home = todaysDollars ?(year30.homeValue * year30.netWorthInTodaysDollars) / year30.netWorth : year30.homeValue;
  const { plan } = result;
  const same = t('Most of your net worth is the same whichever you choose: the home ({0} by year 30), {1}, and what you have already saved.', [
    todaysDollars ? t("{0} in today's dollars", [usd(home)]) : usd(home),
    plan.employerMatch > 0 ? t('your 401(k) and match') : t('your retirement savings'),
  ]);
  const differs = t('Only the {0} a month of extra cash, and the {1} payment once the mortgage is gone, go somewhere different.', [usd(plan.extraCash + plan.esppContribution), usd(plan.mortgagePayment)]);
  if (Math.round(spread) === 0) return [t('All three end the same.'), same, differs].join(' ');
  const share = decimal((spread / best) * 100, 1);
  return [t('All three end within {0} ({1}%) of each other.', [usd(spread), share]), same, differs].join(' ');
}

/** What the invested extra cash keeps after tax: the IRA share tax-free, the rest taxed once, on selling. */
function investingTaxLine(result: StrategyComparison): string {
  const { rates } = result;
  if (rates.iraShelteredPercent >= 100) return t('Your extra cash fits in your IRA, so it grows tax-free: the full {0}.', [pct(rates.riskAdjustedReturn)]);
  const taxed = t('taxed only when sold, keeps about {0} a year', [pct(rates.taxableAfterTaxReturn)]);
  if (rates.iraShelteredPercent <= 0) return t('Invested cash goes to a taxable account: {0}.', [taxed]);
  return t('{0} of your extra cash fits in your IRA, tax-free; the rest, {1}. Together: {2}.', [pct(rates.iraShelteredPercent), taxed, pct(rates.afterTaxRiskAdjustedReturn)]);
}

/** The fact sheet: why the recommendation came out the way it did, one point per line. */
export function facts(result: StrategyComparison): string[] {
  const { rates, plan } = result;
  const lines: string[] = [];

  const adjusts = rates.averageMortgageRate !== rates.mortgageRate;
  const mortgageEarns = rates.interestIsDeducted ? t('{0} after tax', [pct(rates.afterTaxMortgageRate)]) : pct(rates.afterTaxMortgageRate);
  if (adjusts) {
    lines.push(t("Your rate adjusts: {0} now, {1} on average over the loan on the path you expect, so paying it down earns about {2}: certain for the fixed years, an estimate after. The market's {3} is an average, not a promise, so the ranking counts on {4}.", [
      pct(rates.mortgageRate), pct(rates.averageMortgageRate), mortgageEarns, pct(rates.expectedReturn), pct(rates.riskAdjustedReturn),
    ]));
  } else {
    const args = [pct(rates.afterTaxMortgageRate), pct(rates.expectedReturn), pct(rates.riskAdjustedReturn)];
    lines.push(rates.interestIsDeducted
      ? t("Paying down the mortgage earns {0} for certain after tax. The market's {1} is an average, not a promise, so the ranking counts on {2}.", args)
      : t("Paying down the mortgage earns {0} for certain. The market's {1} is an average, not a promise, so the ranking counts on {2}.", args));
  }

  const edge = rates.rateEdge > 0
    ? t('That leaves investing {0} points ahead.', [decimal(rates.rateEdge)])
    : rates.rateEdge < 0 ? t('That leaves the mortgage {0} points ahead.', [decimal(-rates.rateEdge)]) : t('That leaves the two even.');
  lines.push(`${investingTaxLine(result)} ${edge}`);

  lines.push(rates.interestIsDeducted
    ? t('Itemizing beats your {0} standard deduction, so year-1 interest of {1} saves {2} in tax. That shrinks as the balance falls and the standard deduction rises with inflation.', [usd(rates.standardDeduction), usd(rates.firstYearInterest), usd(rates.firstYearTaxSaved)])
    : t("Your {0} of year-1 interest doesn't beat the {1} standard deduction, so it saves no tax: paying it down earns the full {2}.", [usd(rates.firstYearInterest), usd(rates.standardDeduction), pct(rates.mortgageRate)]));

  const payOff = outcomeOf(result, 'PayOffFirst').riskAdjusted;
  const invest = outcomeOf(result, 'InvestTheDifference').riskAdjusted;
  if (invest.totalMortgageInsurance > 0) {
    const ends = (p: typeof payOff) => (p.mortgageInsuranceEndDate ? monthOf(p.mortgageInsuranceEndDate) : t('at once'));
    lines.push(t("Your PMI ends once you owe 80% of the home's value: {0} if you pay down first, {1} if you invest. Paying down saves {2} of it, a return investing doesn't earn.", [
      ends(payOff), ends(invest), usd(invest.totalMortgageInsurance - payOff.totalMortgageInsurance),
    ]));
  }

  if (plan.employerMatch > 0) {
    lines.push(t('Every strategy first collects the full 401(k) match: {0} a month free for {1} of take-home pay, an instant {2} return no mortgage can beat.', [
      usd(plan.employerMatch), usd(plan.retirementContributionCost), pct(rates.employerMatchPercent),
    ]));
  }

  if (rates.buydownSubsidy > 0) {
    lines.push(t('The buydown pays {0} of your payments in its first years: in every strategy, that cash goes to work too.', [usd(rates.buydownSubsidy)]));
  }

  if (plan.esppContribution > 0) {
    lines.push(t('Every strategy takes the ESPP discount too: a {0} gain on each purchase, before tax.', [pct(rates.esppGainPercent)]));
  }

  if (rates.automaticAnnualStock > 0) {
    const args = [usd(rates.automaticAnnualStock), pct(rates.targetInvestPercent), pct(rates.hybridInvestPercent)];
    lines.push(rates.hybridInvestPercent === 0
      ? t("Stock you receive anyway (RSUs kept as shares, an ESOP) already puts {0} a year into stock, which counts toward the hybrid's {1} market share. So it invests {2} of your extra cash and puts the rest on the mortgage: the diversified choice.", args)
      : t("Stock you receive anyway (RSUs kept as shares, an ESOP) already puts {0} a year into stock, which counts toward the hybrid's {1} market share. So it invests {2} of your extra cash, and puts the rest on the mortgage.", args));
  } else {
    lines.push(t('The hybrid invests {0} of your extra cash and puts {1} on the mortgage.', [pct(rates.hybridInvestPercent), pct(100 - rates.hybridInvestPercent)]));
  }

  return lines;
}

/** When a strategy's investments first cover what is owed on the mortgage. */
export function crossover(strategy: PayoffStrategy, projection: StrategyProjection): string {
  const name = nameOf(strategy);
  if (projection.crossoverMonth === 0) return t('With {0}, your investments (after tax) already cover the mortgage.', [name]);
  if (projection.crossoverDate) return t('With {0}, your investments (after tax) pass what you owe on the mortgage in {1}.', [name, monthOf(projection.crossoverDate)]);
  return t('With {0}, your investments never catch up with the mortgage within 30 years.', [name]);
}

/** The scenario picker's labels, with the return each assumes. */
export function scenarioLabel(result: StrategyComparison, scenario: MarketScenario): string {
  const { rates } = result;
  switch (scenario) {
    case 'riskAdjusted':
      return t('Risk-adjusted ({0})', [pct(rates.riskAdjustedReturn)]);
    case 'expected':
      return t('Expected ({0})', [pct(rates.expectedReturn)]);
    case 'badDecade':
      return t('Bad decade first');
  }
}
