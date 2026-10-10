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
  schoolTaxRate: number;
  localTaxRate: number;
  mudTaxRate: number;
  isHomestead: boolean;
  schoolHomesteadExemption: number;
  localHomesteadExemptionPercent: number;
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

export interface AmortizationRequest {
  homePrice: number;
  downPayment: number;
  annualInterestRate: number;
  termInMonths: number;
  firstPaymentDate: string | null; // ISO date, yyyy-MM-dd
  strategy: ExtraPaymentStrategy;
  recast: RecastTerms | null;
  extraPayments: ExtraPayments | null;
  housingCosts: HousingCostsInput | null;
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
  totalOutlay: number;
  remainingBalance: number;
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
  costs: HousingCosts;
}

export interface AmortizationResponse {
  purchase: Purchase;
  baseline: Schedule;
  accelerated: Schedule;
  savings: Savings;
  projection: YearProjection[];
}
