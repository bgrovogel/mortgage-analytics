import {
  MarketScenario,
  PayoffStrategy,
  STRATEGIES,
  StrategyComparison,
  StrategyOutcome,
  StrategyProjection,
} from '../../core/models/strategy.models';
import { decimal, monthOf, pct, usd } from '../../core/formatting/format';

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
    ? `counting on ${pct(rates.riskAdjustedReturn)} a year (your ${pct(rates.expectedReturn)} less ${decimal(rates.riskMargin)} points for risk)`
    : `counting on your full ${pct(rates.expectedReturn)} a year`;
  // A tie goes to the strategy with less risk (paying off first). Investing ties the hybrid only when the hybrid
  // invests everything too: then they are one plan, not two that happen to end level.
  const tie = result.recommended === 'PayOffFirst'
    ? `Tied with ${nameOf(result.runnerUp)} after 30 years, ${countingOn}. Paying down debt carries no market risk, so it takes the tie.`
    : `${countingOn[0].toUpperCase()}${countingOn.slice(1)}, the hybrid invests all your extra cash too, so the two are the same plan.`;
  const detail = result.lead > 0 ? `${usd(result.lead)} ahead of ${nameOf(result.runnerUp)} after 30 years, ${countingOn}.` : tie;

  const badWinner = result.badDecadeWinner;
  const lostDecade = `a lost decade (${pct(rates.badDecadeReturn)} a year, like 2000–2009)`;
  if (badWinner !== result.recommended) {
    const margin = finalNetWorth(outcomeOf(result, badWinner).badDecade) - finalNetWorth(best.badDecade);
    return {
      headline: nameOf(result.recommended),
      detail,
      downside: `Not guaranteed: after ${lostDecade}, ${nameOf(badWinner)} would win by ${usd(margin)}.`,
      reversible: true,
    };
  }
  return { headline: nameOf(result.recommended), detail, downside: `It stays ahead even after ${lostDecade}.`, reversible: false };
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
  const same = `Most of your net worth is the same whichever you choose: the home (${usd(home)}${todaysDollars ? " in today's dollars" : ''} by year 30), `
    + `${plan.employerMatch > 0 ? 'your 401(k) and match' : 'your retirement savings'}, and what you have already saved.`;
  const differs = `Only the ${usd(plan.extraCash + plan.esppContribution)} a month of extra cash, and the ${usd(plan.mortgagePayment)} `
    + 'payment once the mortgage is gone, go somewhere different.';
  if (Math.round(spread) === 0) return `All three end the same. ${same} ${differs}`;
  const share = decimal((spread / best) * 100, 1);
  return `All three end within ${usd(spread)} (${share}%) of each other. ${same} ${differs}`;
}

/** What the invested extra cash keeps after tax: the IRA share tax-free, the rest taxed once, on selling. */
function investingTaxLine(result: StrategyComparison): string {
  const { rates } = result;
  if (rates.iraShelteredPercent >= 100) return `Your extra cash fits in your IRA, so it grows tax-free: the full ${pct(rates.riskAdjustedReturn)}.`;
  const taxed = `taxed only when sold, keeps about ${pct(rates.taxableAfterTaxReturn)} a year`;
  if (rates.iraShelteredPercent <= 0) return `Invested cash goes to a taxable account: ${taxed}.`;
  return `${pct(rates.iraShelteredPercent)} of your extra cash fits in your IRA, tax-free; the rest, ${taxed}. `
    + `Together: ${pct(rates.afterTaxRiskAdjustedReturn)}.`;
}

/** The fact sheet: why the recommendation came out the way it did, one point per line. */
export function facts(result: StrategyComparison): string[] {
  const { rates, plan } = result;
  const lines: string[] = [];

  const adjusts = rates.averageMortgageRate !== rates.mortgageRate;
  lines.push(adjusts
    ? `Your rate adjusts: ${pct(rates.mortgageRate)} now, ${pct(rates.averageMortgageRate)} on average over the loan on the path you expect, `
      + `so paying it down earns about ${pct(rates.afterTaxMortgageRate)}${rates.interestIsDeducted ? ' after tax' : ''}: certain for the fixed years, `
      + `an estimate after. The market's ${pct(rates.expectedReturn)} is an average, not a promise, so the ranking counts on ${pct(rates.riskAdjustedReturn)}.`
    : `Paying down the mortgage earns ${pct(rates.afterTaxMortgageRate)} for certain${rates.interestIsDeducted ? ' after tax' : ''}. `
      + `The market's ${pct(rates.expectedReturn)} is an average, not a promise, so the ranking counts on ${pct(rates.riskAdjustedReturn)}.`);

  const edge = rates.rateEdge > 0
    ? `That leaves investing ${decimal(rates.rateEdge)} points ahead.`
    : rates.rateEdge < 0 ? `That leaves the mortgage ${decimal(-rates.rateEdge)} points ahead.` : 'That leaves the two even.';
  lines.push(`${investingTaxLine(result)} ${edge}`);

  lines.push(rates.interestIsDeducted
    ? `Itemizing beats your ${usd(rates.standardDeduction)} standard deduction, so year-1 interest of ${usd(rates.firstYearInterest)} saves `
      + `${usd(rates.firstYearTaxSaved)} in tax. That shrinks as the balance falls and the standard deduction rises with inflation.`
    : `Your ${usd(rates.firstYearInterest)} of year-1 interest doesn't beat the ${usd(rates.standardDeduction)} standard deduction, `
      + `so it saves no tax: paying it down earns the full ${pct(rates.mortgageRate)}.`);

  const payOff = outcomeOf(result, 'PayOffFirst').riskAdjusted;
  const invest = outcomeOf(result, 'InvestTheDifference').riskAdjusted;
  if (invest.totalMortgageInsurance > 0) {
    const ends = (p: typeof payOff) => (p.mortgageInsuranceEndDate ? monthOf(p.mortgageInsuranceEndDate) : 'at once');
    lines.push(`Your PMI ends once you owe 80% of the home's value: ${ends(payOff)} if you pay down first, ${ends(invest)} if you invest. `
      + `Paying down saves ${usd(invest.totalMortgageInsurance - payOff.totalMortgageInsurance)} of it, a return investing doesn't earn.`);
  }

  if (plan.employerMatch > 0) {
    lines.push(`Every strategy first collects the full 401(k) match: ${usd(plan.employerMatch)} a month free for ${usd(plan.retirementContributionCost)} `
      + `of take-home pay, an instant ${pct(rates.employerMatchPercent)} return no mortgage can beat.`);
  }

  if (rates.buydownSubsidy > 0) {
    lines.push(`The buydown pays ${usd(rates.buydownSubsidy)} of your payments in its first years: in every strategy, that cash goes to work too.`);
  }

  if (plan.esppContribution > 0) {
    lines.push(`Every strategy takes the ESPP discount too: a ${pct(rates.esppGainPercent)} gain on each purchase, before tax.`);
  }

  lines.push(rates.automaticAnnualStock > 0
    ? `Stock you receive anyway (RSUs kept as shares, an ESOP) already puts ${usd(rates.automaticAnnualStock)} a year into stock, which counts toward the hybrid's `
      + `${pct(rates.targetInvestPercent)} market share. So it invests ${pct(rates.hybridInvestPercent)} of your extra cash`
      + (rates.hybridInvestPercent === 0 ? ' and puts the rest on the mortgage: the diversified choice.' : ', and puts the rest on the mortgage.')
    : `The hybrid invests ${pct(rates.hybridInvestPercent)} of your extra cash and puts ${pct(100 - rates.hybridInvestPercent)} on the mortgage.`);

  return lines;
}

/** When a strategy's investments first cover what is owed on the mortgage. */
export function crossover(strategy: PayoffStrategy, projection: StrategyProjection): string {
  const name = nameOf(strategy);
  if (projection.crossoverMonth === 0) return `With ${name}, your investments (after tax) already cover the mortgage.`;
  if (projection.crossoverDate) return `With ${name}, your investments (after tax) pass what you owe on the mortgage in ${monthOf(projection.crossoverDate)}.`;
  return `With ${name}, your investments never catch up with the mortgage within 30 years.`;
}

/** The scenario picker's labels, with the return each assumes. */
export function scenarioLabel(result: StrategyComparison, scenario: MarketScenario): string {
  const { rates } = result;
  switch (scenario) {
    case 'riskAdjusted':
      return `Risk-adjusted (${pct(rates.riskAdjustedReturn)})`;
    case 'expected':
      return `Expected (${pct(rates.expectedReturn)})`;
    case 'badDecade':
      return 'Bad decade first';
  }
}
