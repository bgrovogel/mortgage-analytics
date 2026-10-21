import { t } from '../i18n/i18n';
import { AdjustableRateInput, TemporaryBuydownInput } from './amortization.models';
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
  /** PMI on the mortgage each month now; 0 for none. It ends once the balance is 80% of the home's value. */
  monthlyPmi?: number;
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
  /** The mortgage's rate adjusts: today's rate, then resets (the fixed period counts payments to the next one). */
  adjustableRate?: AdjustableRateInput | null;
  /** A temporary buydown on a new mortgage, starting with its next payment. */
  buydown?: TemporaryBuydownInput | null;
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
  iraShelteredPercent: number;
  taxableAfterTaxReturn: number;
  afterTaxRiskAdjustedReturn: number;
  rateEdge: number;
  badDecadeReturn: number;
  employerMatchPercent: number;
  esppGainPercent: number;
  targetInvestPercent: number;
  automaticAnnualStock: number;
  discretionaryAnnualCash: number;
  hybridInvestPercent: number;
  /** The mortgage's rate averaged over its payments left: its rate, unless it adjusts. */
  averageMortgageRate: number;
  /** What a buydown's subsidy pays in all; 0 without one. */
  buydownSubsidy: number;
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
  /** PMI paid; 0 without any. */
  totalMortgageInsurance: number;
  /** The last payment with PMI, or null without any. */
  mortgageInsuranceEndDate: string | null;
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
  PayOffFirst: { get name() { return t('Debt free ASAP'); }, get short() { return t('Pay off first'); }, color: '--series-3' },
  InvestTheDifference: { get name() { return t('Invest the difference'); }, get short() { return t('Invest'); }, color: '--series-1' },
  Hybrid: { get name() { return t('Hybrid'); }, get short() { return t('Hybrid'); }, color: '--series-2' },
};
