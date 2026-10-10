import {
  AmortizationResponse,
  HousingCosts,
  Payment,
  Purchase,
  Savings,
  Schedule,
  YearProjection,
} from '../app/core/models/amortization.models';
import { LoanPayment, RefinanceOption, RefinanceResponse } from '../app/core/models/refinance.models';

/**
 * Test-data builders for the client. Each returns a small, valid object with sensible defaults,
 * and a test overrides only the fields its scenario is about.
 */

/** Housing costs with every category at zero unless overridden. */
export function aHousingCosts(overrides: Partial<HousingCosts> = {}): HousingCosts {
  const costs: HousingCosts = {
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
    costs.total = costs.schoolTax + costs.localTax + costs.mudTax + costs.pidAssessment
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
    ...overrides,
  };
}

/** A projection year with no costs and a flat $250,000 value. */
export function aProjectionYear(year: number, overrides: Partial<YearProjection> = {}): YearProjection {
  return {
    year,
    startDate: `${2025 + year}-01-01`,
    marketValue: 250_000,
    taxableValue: 250_000,
    costs: aHousingCosts(),
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
    ...overrides,
  };
}
