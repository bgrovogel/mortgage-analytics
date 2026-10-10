import {
  AmortizationResponse,
  HousingCosts,
  Payment,
  Purchase,
  Savings,
  Schedule,
  YearProjection,
} from '../app/core/models/amortization.models';

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
    mortgageInsurance: 0,
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
