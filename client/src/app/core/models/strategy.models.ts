/** TypeScript mirrors of the strategy contracts (MortgageAnalytics.Application.Contracts). */

export type TaxFilingStatus = 'Single' | 'MarriedFilingJointly' | 'HeadOfHousehold';
export type InvestorRiskProfile = 'Conservative' | 'Balanced' | 'Aggressive';
export type PayoffStrategy = 'PayOffFirst' | 'InvestTheDifference' | 'Hybrid';
/** The three market paths each strategy is played out in. */
export type MarketScenario = 'riskAdjusted' | 'expected' | 'badDecade';

export interface StrategyRequest {
  currentBalance: number;
  annualInterestRate: number;
  remainingTermInMonths: number;
  nextPaymentDate: string | null;
  homeValue: number;
  homeGrowthRate: number;
  grossAnnualIncome: number;
  marginalTaxRate: number;
  capitalGainsTaxRate: number;
  filingStatus: TaxFilingStatus;
  otherItemizedDeductions: number;
  monthlyCashToPutToWork: number;
  employerMatchPercent: number;
  matchUpToPercentOfPay: number;
  esppContributionPercent: number;
  esppDiscountPercent: number;
  esppPurchasePeriodMonths: number;
  annualIraContribution: number;
  annualRsuVesting: number;
  sellRsusAtVest: boolean;
  annualEsopContribution: number;
  currentRetirementSavings: number;
  currentInvestments: number;
  expectedAnnualReturn: number;
  inflationRate: number;
  riskProfile: InvestorRiskProfile;
}

export interface MonthlyCashPlan {
  mortgagePayment: number;
  retirementContribution: number;
  employerMatch: number;
  retirementContributionCost: number;
  esppContribution: number;
  extraCash: number;
}

export interface StrategyRates {
  mortgageRate: number;
  firstYearInterest: number;
  firstYearTaxSaved: number;
  standardDeduction: number;
  interestIsDeducted: boolean;
  afterTaxMortgageRate: number;
  expectedReturn: number;
  riskMargin: number;
  riskAdjustedReturn: number;
  afterTaxRiskAdjustedReturn: number;
  rateEdge: number;
  badDecadeReturn: number;
  employerMatchPercent: number;
  esppGainPercent: number;
  targetInvestPercent: number;
  automaticAnnualStock: number;
  discretionaryAnnualCash: number;
  hybridInvestPercent: number;
}

/** Where a strategy stands at the end of a year (year 0 is today). */
export interface NetWorthYear {
  year: number;
  homeValue: number;
  mortgageBalance: number;
  homeEquity: number;
  investments: number;
  netWorth: number;
  netWorthInTodaysDollars: number;
}

export interface StrategyProjection {
  totalInterest: number;
  totalTaxSaved: number;
  payoffMonth: number | null;
  payoffDate: string | null;
  crossoverMonth: number | null;
  crossoverDate: string | null;
  years: NetWorthYear[];
}

export interface StrategyOutcome {
  strategy: PayoffStrategy;
  investPercent: number;
  expected: StrategyProjection;
  riskAdjusted: StrategyProjection;
  badDecade: StrategyProjection;
}

export interface StrategyComparison {
  recommended: PayoffStrategy;
  runnerUp: PayoffStrategy;
  lead: number;
  leadPercent: number | null;
  expectedWinner: PayoffStrategy;
  badDecadeWinner: PayoffStrategy;
  plan: MonthlyCashPlan;
  rates: StrategyRates;
  strategies: StrategyOutcome[];
}

/** How each strategy is named and drawn. The color follows the strategy, never its rank. */
export const STRATEGIES: Record<PayoffStrategy, { name: string; short: string; color: string }> = {
  PayOffFirst: { name: 'Debt free ASAP', short: 'Pay off first', color: '--series-3' },
  InvestTheDifference: { name: 'Invest the difference', short: 'Invest', color: '--series-1' },
  Hybrid: { name: 'Hybrid', short: 'Hybrid', color: '--series-2' },
};
