import {
  AmortizationResponse,
  FhaLoanLimits,
  HousingCosts,
  Payment,
  Purchase,
  Savings,
  Schedule,
  YearProjection,
} from '../app/core/models/amortization.models';
import { LoanPayment, RefinanceOption, RefinanceResponse } from '../app/core/models/refinance.models';
import { NetWorthYear, StrategyComparison, StrategyOutcome, StrategyProjection } from '../app/core/models/strategy.models';

/**
 * Test-data builders for the client. Each returns a small, valid object with sensible defaults,
 * and a test overrides only the fields its scenario is about.
 */

/** Housing costs with every category at zero unless overridden. */
export function aHousingCosts(overrides: Partial<HousingCosts> = {}): HousingCosts {
  const costs: HousingCosts = {
    propertyTax: 0,
    schoolTax: 0,
    localTax: 0,
    mudTax: 0,
    pidAssessment: 0,
    homeownersInsurance: 0,
    mortgageInsurance: 0,
    hoaDues: 0,
    total: 0,
    ...overrides,
  };
  if (overrides.total === undefined) {
    costs.total = costs.propertyTax + costs.schoolTax + costs.localTax + costs.mudTax + costs.pidAssessment
      + costs.homeownersInsurance + costs.mortgageInsurance + costs.hoaDues;
  }
  return costs;
}

/** One payment row; payment 1 is due 2026-01-01 and each later payment a month after. */
export function aPayment(paymentNumber: number, overrides: Partial<Payment> = {}): Payment {
  const due = new Date(Date.UTC(2026, paymentNumber - 1, 1)).toISOString().slice(0, 10);
  return {
    paymentNumber,
    dueDate: due,
    scheduledPayment: 1_000,
    principal: 600,
    interest: 400,
    extraPrincipal: 0,
    housingCosts: 0,
    costs: aHousingCosts(),
    totalOutlay: 1_000,
    remainingBalance: Math.max(0, 3_000 - paymentNumber * 600),
    annualInterestRate: 6,
    buydownSubsidy: 0,
    ...overrides,
  };
}

/** A schedule with <code>paymentCount</code> rows (default 3) and no housing costs. */
export function aSchedule(overrides: Partial<Schedule> = {}, paymentCount = 3): Schedule {
  const payments = overrides.payments ?? Array.from({ length: paymentCount }, (_, i) => aPayment(i + 1));
  return {
    monthlyPayment: 1_000,
    monthlyHousingCosts: aHousingCosts(),
    totalMonthlyPayment: 1_000,
    numberOfPayments: payments.length,
    totalInterest: 1_200,
    totalPaid: 3_000,
    totalHousingCosts: aHousingCosts(),
    mortgageInsuranceEndDate: null,
    payoffDate: payments[payments.length - 1].dueDate,
    recasts: [],
    payments,
    rateChanges: [],
    buydownSubsidy: 0,
    interestYouPay: overrides.totalInterest ?? 1_200,
    ...overrides,
  };
}

/** A projection year with no costs and a flat $250,000 value. */
export function aProjectionYear(year: number, overrides: Partial<YearProjection> = {}): YearProjection {
  return {
    year,
    startDate: `${2025 + year}-01-01`,
    marketValue: 250_000,
    assessedValue: 250_000,
    schoolTaxableValue: null,
    localTaxableValue: null,
    mudTaxableValue: null,
    propertyTaxableValue: null,
    costs: aHousingCosts(),
    loanBalance: 200_000,
    equity: 50_000,
    ...overrides,
  };
}

/** A purchase with 20% down (no PMI). */
export function aPurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    homePrice: 250_000,
    downPayment: 50_000,
    downPaymentPercent: 20,
    loanAmount: 200_000,
    loanToValuePercent: 80,
    mortgageInsuranceRequired: false,
    ...overrides,
  };
}

/** Savings of zero (no extra payments) unless overridden. */
export function aSavings(overrides: Partial<Savings> = {}): Savings {
  return {
    interestSaved: 0,
    mortgageInsuranceSaved: 0,
    recastFees: 0,
    netSavings: 0,
    paymentsSaved: 0,
    totalExtraPrincipal: 0,
    originalPayoffDate: '2026-03-01',
    acceleratedPayoffDate: '2026-03-01',
    ...overrides,
  };
}

/** A complete response: identical baseline and accelerated schedules, three projection years. */
export function aResponse(overrides: Partial<AmortizationResponse> = {}): AmortizationResponse {
  return {
    purchase: aPurchase(),
    baseline: aSchedule(),
    accelerated: aSchedule(),
    savings: aSavings(),
    projection: [1, 2, 3].map((y) => aProjectionYear(y)),
    buydown: null,
    adjustableRate: null,
    ...overrides,
  };
}

/** A repayment option with a few payment rows (balance falling to zero). */
export function aRefinanceOption(overrides: Partial<RefinanceOption> = {}, paymentCount = 3): RefinanceOption {
  const payments: LoanPayment[] = Array.from({ length: paymentCount }, (_, i) => ({
    paymentNumber: i + 1,
    dueDate: new Date(Date.UTC(2026, i, 1)).toISOString().slice(0, 10),
    principal: 100,
    interest: 50,
    extraPrincipal: 0,
    remainingBalance: (paymentCount - i - 1) * 100,
  }));
  return {
    loanAmount: paymentCount * 100,
    monthlyPayment: 150,
    extraMonthlyPrincipal: 0,
    numberOfPayments: paymentCount,
    totalInterest: paymentCount * 50,
    totalPaid: paymentCount * 150,
    payoffDate: payments[paymentCount - 1].dueDate,
    payments,
    rateChanges: [],
    monthlyPmi: 0,
    totalPmi: 0,
    pmiEndDate: null,
    ...overrides,
  };
}

/**
 * The reference refinance (7% with 25 years left, to 6% over a new 30 years, $6,000 at closing): the
 * payment drops $321.69 but the total cost rises $17,415.28, because the clock restarts.
 */
export function aRefinanceResponse(overrides: Partial<RefinanceResponse> = {}): RefinanceResponse {
  return {
    current: aRefinanceOption({ loanAmount: 300_000, monthlyPayment: 2_120.34, numberOfPayments: 300, totalInterest: 336_100.16, totalPaid: 636_100.16, payoffDate: '2050-12-01' }),
    refinanced: aRefinanceOption({
      loanAmount: 300_000, monthlyPayment: 1_798.65, numberOfPayments: 360, totalInterest: 347_515.44, totalPaid: 647_515.44, payoffDate: '2055-12-01',
      payments: [{ paymentNumber: 1, dueDate: '2026-01-01', principal: 298.65, interest: 1_500, extraPrincipal: 0, remainingBalance: 299_701.35 }],
    }),
    keepingCurrentPayment: aRefinanceOption({
      loanAmount: 300_000, monthlyPayment: 1_798.65, extraMonthlyPrincipal: 321.69, numberOfPayments: 247, totalInterest: 222_510.04,
      totalPaid: 522_510.04, payoffDate: '2046-07-01',
    }),
    upfrontCosts: 6_000,
    monthlySavings: 321.69,
    interestSaved: -11_415.28,
    lifetimeSavings: -17_415.28,
    keepingCurrentPaymentLifetimeSavings: 107_590.12,
    monthsAdded: 60,
    breakEvenPaymentNumber: 25,
    breakEvenDate: '2028-01-01',
    buydownCost: 0,
    newBuydown: null,
    worstCaseLifetimeSavings: null,
    ...overrides,
  };
}

/** A 30-year projection whose net worth climbs in a straight line to `finalNetWorth`; the home is the same in every one. */
export function aStrategyProjection(finalNetWorth: number, overrides: Partial<StrategyProjection> = {}): StrategyProjection {
  const years: NetWorthYear[] = Array.from({ length: 31 }, (_, year) => {
    const netWorth = 100_000 + ((finalNetWorth - 100_000) * year) / 30;
    const mortgageBalance = Math.max(0, 300_000 - year * 20_000);
    const homeEquity = 400_000 + year * 10_000 - mortgageBalance;
    return {
      year,
      homeValue: 400_000 + year * 10_000,
      mortgageBalance,
      homeEquity,
      // Whatever the home does not account for, as on the server: net worth = home equity + investments.
      investments: netWorth - homeEquity,
      netWorth,
      netWorthInTodaysDollars: netWorth / 2,
    };
  });
  return {
    totalInterest: 200_000, totalTaxSaved: 0, payoffMonth: 180, payoffDate: '2041-01-01', crossoverMonth: 90, crossoverDate: '2033-06-01',
    totalMortgageInsurance: 0, mortgageInsuranceEndDate: null, years, ...overrides,
  };
}

/**
 * The reference comparison (ReferenceStrategies.Typical on the server): investing wins at a risk-adjusted 8%,
 * paying off first wins if the next decade is lost. Year-30 net worths are the server's.
 */
export function aStrategyComparison(overrides: Partial<StrategyComparison> = {}): StrategyComparison {
  const outcome = (strategy: StrategyOutcome['strategy'], investPercent: number, expected: number, riskAdjusted: number, badDecade: number,
    marks: Partial<StrategyProjection>): StrategyOutcome => ({
    strategy,
    investPercent,
    expected: aStrategyProjection(expected, marks),
    riskAdjusted: aStrategyProjection(riskAdjusted, marks),
    badDecade: aStrategyProjection(badDecade, marks),
  });
  return {
    recommended: 'InvestTheDifference',
    runnerUp: 'Hybrid',
    lead: 18_150.18,
    leadPercent: 0.5,
    expectedWinner: 'InvestTheDifference',
    badDecadeWinner: 'PayOffFirst',
    plan: { mortgagePayment: 2_025.62, retirementContribution: 600, employerMatch: 300, retirementContributionCost: 456, esppContribution: 0, extraCash: 544 },
    rates: {
      mortgageRate: 6.5, firstYearInterest: 19_354.15, firstYearTaxSaved: 0, standardDeduction: 32_200, interestIsDeducted: false,
      afterTaxMortgageRate: 6.5, expectedReturn: 10, riskMargin: 2, riskAdjustedReturn: 8, iraShelteredPercent: 100, taxableAfterTaxReturn: 7.41,
      afterTaxRiskAdjustedReturn: 8, rateEdge: 1.5, badDecadeReturn: -1, employerMatchPercent: 50, esppGainPercent: 0, targetInvestPercent: 88,
      automaticAnnualStock: 0, discretionaryAnnualCash: 6_528, hybridInvestPercent: 88, averageMortgageRate: 6.5, buydownSubsidy: 0,
    },
    strategies: [
      outcome('PayOffFirst', 0, 4_700_702.7, 3_719_026.59, 3_187_295.65, { payoffMonth: 186, payoffDate: '2041-06-01', crossoverMonth: 93, crossoverDate: '2033-09-01', totalInterest: 176_023.74 }),
      outcome('InvestTheDifference', 100, 5_060_856.45, 3_844_781.09, 3_145_932.42, { payoffMonth: 300, payoffDate: '2050-12-01', crossoverMonth: 92, crossoverDate: '2033-08-01', totalInterest: 307_687.31 }),
      outcome('Hybrid', 88, 5_007_419.45, 3_826_630.91, 3_147_836.56, { payoffMonth: 278, payoffDate: '2049-02-01', crossoverMonth: 92, crossoverDate: '2033-08-01', totalInterest: 281_119.21 }),
    ],
    ...overrides,
  };
}

/** A few real counties from HUD's 2026 table. */
export const FHA_LIMITS: FhaLoanLimits = {
  year: 2026, source: 'HUD', floor: 541_287, ceiling: 1_249_125,
  states: { FL: 'Florida', TX: 'Texas' },
  counties: [
    { fips: '12086', state: 'FL', name: 'Miami-Dade County', limit: 667_000 },
    { fips: '48029', state: 'TX', name: 'Bexar County', limit: 557_750 },
    { fips: '48201', state: 'TX', name: 'Harris County', limit: 541_287 },
  ],
};
