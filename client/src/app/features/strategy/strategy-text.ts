import {
  MarketScenario,
  PayoffStrategy,
  STRATEGIES,
  StrategyComparison,
  StrategyOutcome,
  StrategyProjection,
} from '../../core/models/strategy.models';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "$1,234". */
export const usd = (value: number) => dollars.format(value);
/** "6.5%". */
export const pct = (value: number) => `${percent.format(value)}%`;
/** "Sep 2033". */
export const monthOf = (iso: string) => monthYear.format(new Date(`${iso}T00:00:00Z`));
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
    ? `counting on ${pct(rates.riskAdjustedReturn)} a year: your ${pct(rates.expectedReturn)} expected return minus ${percent.format(rates.riskMargin)} points for risk`
    : `counting on your full ${pct(rates.expectedReturn)} expected return`;
  const detail = result.lead > 0
    ? `${usd(result.lead)} more than ${nameOf(result.runnerUp)} after 30 years${result.leadPercent !== null ? ` (+${percent.format(result.leadPercent)}%)` : ''}, ${countingOn}.`
    : `It ties with ${nameOf(result.runnerUp)} after 30 years, ${countingOn}; paying down debt carries no market risk, so it takes the tie.`;

  const badWinner = result.badDecadeWinner;
  const lostDecade = `a lost decade (${pct(rates.badDecadeReturn)} a year for ten years, like 2000–2009)`;
  if (badWinner !== result.recommended) {
    const margin = finalNetWorth(outcomeOf(result, badWinner).badDecade) - finalNetWorth(best.badDecade);
    return {
      headline: nameOf(result.recommended),
      detail,
      downside: `Not guaranteed: if the next ten years are ${lostDecade}, ${nameOf(badWinner)} comes out ahead by ${usd(margin)}.`,
      reversible: true,
    };
  }
  return {
    headline: nameOf(result.recommended),
    detail,
    downside: `Even if the next ten years are ${lostDecade}, it still comes out ahead.`,
    reversible: false,
  };
}

/** The fact sheet: why the recommendation came out the way it did, one point per line. */
export function facts(result: StrategyComparison): string[] {
  const { rates, plan } = result;
  const lines: string[] = [];

  lines.push(
    `Paying down the mortgage earns ${pct(rates.afterTaxMortgageRate)} for certain${rates.interestIsDeducted ? ' after tax' : ''}. `
    + `The market's ${pct(rates.expectedReturn)} is a long-run average, not a promise, so the ranking counts on ${pct(rates.riskAdjustedReturn)}`
    + (rates.afterTaxRiskAdjustedReturn !== rates.riskAdjustedReturn ? `, about ${pct(rates.afterTaxRiskAdjustedReturn)} after capital gains tax.` : '.'),
  );

  if (rates.rateEdge > 0) lines.push(`That puts the market ${percent.format(rates.rateEdge)} points ahead after tax and risk, which favors investing.`);
  else if (rates.rateEdge < 0) lines.push(`That puts the mortgage ${percent.format(-rates.rateEdge)} points ahead after tax and risk, which favors paying it down.`);
  else lines.push('After tax and risk the two earn the same.');

  lines.push(rates.interestIsDeducted
    ? `Itemizing beats your ${usd(rates.standardDeduction)} standard deduction, so the ${usd(rates.firstYearInterest)} of interest in year 1 saves `
      + `${usd(rates.firstYearTaxSaved)} in tax. Only deductions above the standard deduction save anything, and the break shrinks as the balance falls.`
    : `Your ${usd(rates.firstYearInterest)} of interest in year 1 doesn't lift your deductions above the ${usd(rates.standardDeduction)} standard `
      + `deduction, so it saves no tax: paying it down earns the full ${pct(rates.mortgageRate)}.`);

  if (plan.employerMatch > 0) {
    lines.push(`Every strategy first puts ${usd(plan.retirementContribution)} a month into your 401(k) to collect the full match: ${usd(plan.employerMatch)} `
      + `a month free, an instant ${pct(rates.employerMatchPercent)} return no mortgage rate can beat. It costs ${usd(plan.retirementContributionCost)} `
      + 'of take-home pay, since it goes in before tax.');
  }

  if (plan.esppContribution > 0) {
    lines.push(`Your ESPP buys stock at a discount and sells it right away: a ${pct(rates.esppGainPercent)} gain on each purchase before tax, `
      + 'taken in every strategy. The proceeds join your extra cash.');
  }

  if (rates.automaticAnnualStock > 0) {
    lines.push(`Your RSUs and ESOP already put ${usd(rates.automaticAnnualStock)} a year into stock. The hybrid counts that toward its `
      + `${pct(rates.targetInvestPercent)} market share, so it invests ${pct(rates.hybridInvestPercent)} of your extra cash`
      + (rates.hybridInvestPercent === 0 ? ' and puts all of it on the mortgage: the diversified choice.' : '.'));
  } else {
    lines.push(`The hybrid invests ${pct(rates.hybridInvestPercent)} of your extra ${usd(plan.extraCash)} a month and puts `
      + `${pct(100 - rates.hybridInvestPercent)} on the mortgage.`);
  }

  lines.push(crossover(result.recommended, outcomeOf(result, result.recommended).riskAdjusted));
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
