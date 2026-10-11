/**
 * TypeScript mirrors of the API contracts (MortgageAnalytics.Application.Contracts).
 * The Swagger document at /swagger/v1/swagger.json is the source of truth.
 */

/** What the borrower does with extra principal. */
export type ExtraPaymentStrategy = 'ShortenTerm' | 'Recast';

/** Whether PMI comes off automatically at 78% loan-to-value or on request at 80%. */
export type MortgageInsuranceCancellation = 'Automatic' | 'BorrowerRequested';

export interface LumpSumPayment {
  paymentNumber: number;
  amount: number;
}

export interface AnnualExtraPayment {
  amount: number;
  firstPaymentNumber: number;
}

export interface ExtraPayments {
  monthlyAmount: number;
  monthlyStartingPaymentNumber: number;
  annual: AnnualExtraPayment | null;
  lumpSums: LumpSumPayment[];
}

export interface RecastTerms {
  minimumLumpSum: number;
  fee: number;
}

export interface PidAssessment {
  annualAssessment: number;
  remainingYears: number | null;
}

/** Extra homestead relief for an owner who is 65 or older, or disabled. */
export interface Over65OrDisabled {
  qualifiesInYear: number;
  schoolExemption: number;
  localExemption: number;
  localTaxCeiling: boolean;
}

export interface HousingCostsInput {
  /** All property taxes as one rate (instead of the separate school, county/city and MUD rates, which are then 0). */
  propertyTaxRate?: number;
  /** With propertyTaxRate: the dollars of a homestead's value exempt from it. */
  propertyTaxHomesteadExemption?: number;
  schoolTaxRate: number;
  localTaxRate: number;
  mudTaxRate: number;
  isHomestead: boolean;
  schoolHomesteadExemption: number;
  localHomesteadExemptionPercent: number;
  mudHomesteadExemptionPercent?: number;
  homesteadAssessmentCap: number;
  over65OrDisabled: Over65OrDisabled | null;
  homeValueGrowthRate: number;
  insuranceIncreaseRate: number;
  hoaIncreaseRate: number;
  pid: PidAssessment | null;
  annualHomeownersInsurance: number;
  monthlyHoaDues: number;
  pmiRate: number;
  pmiCancellation: MortgageInsuranceCancellation;
}

/** A temporary buydown: how many points below the note rate each year is paid at, year 1 first ([2, 1] is a 2-1). */
export interface TemporaryBuydownInput {
  yearlyReductions: number[];
}

/** An adjustable rate: fixed for a while, then resetting toward the rate expected, within caps. */
export interface AdjustableRateInput {
  initialFixedMonths: number;
  adjustmentIntervalMonths: number;
  expectedRate: number;
  initialCap: number;
  periodicCap: number;
  lifetimeCap: number;
  /** The margin over the index: the rate's floor (no higher than the starting rate). Null for none. */
  margin?: number | null;
}

export interface AmortizationRequest {
  homePrice: number;
  downPayment: number;
  /** The note rate with a buydown; the starting rate with an adjustable rate. */
  annualInterestRate: number;
  termInMonths: number;
  firstPaymentDate: string | null; // ISO date, yyyy-MM-dd
  strategy: ExtraPaymentStrategy;
  recast: RecastTerms | null;
  extraPayments: ExtraPayments | null;
  housingCosts: HousingCostsInput | null;
  buydown?: TemporaryBuydownInput | null;
  adjustableRate?: AdjustableRateInput | null;
}

export interface Purchase {
  homePrice: number;
  downPayment: number;
  downPaymentPercent: number;
  loanAmount: number;
  loanToValuePercent: number;
  mortgageInsuranceRequired: boolean;
}

export interface HousingCosts {
  /** All property taxes as one rate, when they are given that way. */
  propertyTax: number;
  schoolTax: number;
  localTax: number;
  mudTax: number;
  pidAssessment: number;
  homeownersInsurance: number;
  mortgageInsurance: number;
  hoaDues: number;
  total: number;
}

export interface Recast {
  afterPaymentNumber: number;
  effectiveDate: string;
  previousPayment: number;
  newPayment: number;
  fee: number;
}

export interface Payment {
  paymentNumber: number;
  dueDate: string;
  scheduledPayment: number;
  principal: number;
  interest: number;
  extraPrincipal: number;
  housingCosts: number;
  /** The same housing costs, by category. */
  costs: HousingCosts;
  /** What the borrower pays: less any buydown subsidy. */
  totalOutlay: number;
  remainingBalance: number;
  annualInterestRate: number;
  buydownSubsidy: number;
}

/** A rate reset, and what it did to the payment. */
export interface RateChange {
  paymentNumber: number;
  effectiveDate: string;
  previousRate: number;
  newRate: number;
  previousPayment: number;
  newPayment: number;
}

export interface Schedule {
  monthlyPayment: number;
  monthlyHousingCosts: HousingCosts;
  totalMonthlyPayment: number;
  numberOfPayments: number;
  totalInterest: number;
  totalPaid: number;
  totalHousingCosts: HousingCosts;
  mortgageInsuranceEndDate: string | null;
  payoffDate: string;
  recasts: Recast[];
  payments: Payment[];
  rateChanges: RateChange[];
}

export interface Savings {
  interestSaved: number;
  mortgageInsuranceSaved: number;
  recastFees: number;
  netSavings: number;
  paymentsSaved: number;
  totalExtraPrincipal: number;
  originalPayoffDate: string;
  acceleratedPayoffDate: string;
}

/** One loan year of the ownership projection (standard schedule). */
export interface YearProjection {
  year: number;
  startDate: string;
  marketValue: number;
  /** Market value held down by the homestead cap, before any exemption. */
  assessedValue: number;
  /** What each tax is charged on, after its own exemptions; null when that tax is not charged. */
  schoolTaxableValue: number | null;
  localTaxableValue: number | null;
  mudTaxableValue: number | null;
  /** What the single combined property tax is charged on; null when the taxes are given separately. */
  propertyTaxableValue: number | null;
  costs: HousingCosts;
}

export interface AmortizationResponse {
  purchase: Purchase;
  baseline: Schedule;
  accelerated: Schedule;
  savings: Savings;
  projection: YearProjection[];
  buydown: BuydownSummary | null;
  adjustableRate: AdjustableRateSummary | null;
}

export interface BuydownSummary {
  noteRate: number;
  /** Each bought-down year, then the first year at the note rate. */
  years: { year: number; annualInterestRate: number; monthlyPayment: number }[];
  totalSubsidy: number;
}

/** An adjustable rate's worst case: rates rising as far and as fast as the caps allow. */
export interface AdjustableRateSummary {
  worstCaseRateChanges: RateChange[];
  worstCasePeakPayment: number;
  worstCaseTotalInterest: number;
}
