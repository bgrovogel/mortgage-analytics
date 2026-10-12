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
  /** A school tax ceiling brought from a former home: the share of school tax paid there, as a percentage. */
  transferredCeilingPercent?: number | null;
}

/** Tax rates that change from a loan year (1-based, from 2) on; a rate left null keeps its value. */
export interface TaxRateChange {
  fromYear: number;
  propertyTaxRate: number | null;
  schoolTaxRate: number | null;
  localTaxRate: number | null;
  mudTaxRate: number | null;
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
  /** New tax rates from given loan years; each lasts until a later change. Only for taxes that are charged. */
  rateChanges?: TaxRateChange[];
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
  /** Who pays for the buydown's subsidy; the seller or builder unless said. */
  buydownPaidBy?: BuydownFunding;
  adjustableRate?: AdjustableRateInput | null;
  /** What is paid at closing besides the down payment; leave out for no cash-to-close estimate. */
  closingCosts?: ClosingCostsInput | null;
  /** Discount points paid for the rate, against the rate without them; not with an adjustable rate. */
  discountPoints?: DiscountPointsInput | null;
  /** An FHA or VA loan; leave out for a conventional one. */
  program?: LoanProgramInput | null;
}

/** The kind of loan. */
export type LoanProgramType = 'Conventional' | 'Fha' | 'Va';

/** Which VA funding fee applies. */
export type VaFundingFeeType = 'FirstUse' | 'SubsequentUse' | 'Exempt';

/** An FHA or VA loan: FHA's upfront and annual MIP, or VA's funding fee; neither has PMI. */
export interface LoanProgramInput {
  type: LoanProgramType;
  /** VA only: a first use, a later one, or exempt. */
  vaUse: VaFundingFeeType | null;
  /** True to add the upfront fee to the loan; false to pay it at closing. */
  financeUpfrontFee: boolean;
}

/** An FHA or VA loan's upfront fee and mortgage insurance, as the API works them out. */
export interface LoanProgramSummary {
  type: LoanProgramType;
  /** FHA's upfront MIP or VA's funding fee, as a percentage of the base loan. */
  upfrontFeePercent: number;
  upfrontFee: number;
  upfrontFeeFinanced: boolean;
  /** What is borrowed: the base loan, plus the fee when financed. */
  loanAmount: number;
  /** FHA's annual MIP; 0 for VA. */
  annualMipPercent: number;
  /** How many payments carry FHA's annual MIP: 132 (11 years) or the whole term. */
  mipPayments: number;
}

/** Discount points: a fee at closing, a percentage of the loan, for a lower rate for the whole loan. */
export interface DiscountPointsInput {
  /** As a percentage of the loan: 1 is one point. */
  points: number;
  /** The rate the lender quotes without them; higher than the loan's rate. */
  rateWithoutPoints: number;
}

/** Discount points against the rate without them, as the API works it out. */
export interface DiscountPointsSummary {
  points: number;
  cost: number;
  rateWithoutPoints: number;
  paymentWithoutPoints: number;
  monthlySaving: number;
  /** Over the whole loan, on the standard schedule. */
  interestSaved: number;
  /** The interest saved less the cost; negative when they lose money. */
  netSaving: number;
  /** The payment by which the interest saved covers the cost; null when it never does. */
  breakEvenPayment: number | null;
  breakEvenDate: string | null;
}

/**
 * Closing costs as a Loan Estimate shows them: the fees as totals, and the prepaids and escrow as counts that the API
 * turns into dollars from the loan. The first year of insurance is always prepaid.
 */
export interface ClosingCostsInput {
  /** The lender's and its services' charges (Loan Estimate section D). */
  loanCosts: number;
  /** Recording fees, transfer taxes, an owner's title policy (sections E and H). */
  otherFees: number;
  /** Days of interest from closing to the end of that month. */
  prepaidInterestDays: number;
  /** Months of taxes and insurance that start the escrow account. */
  escrowMonths: number;
  /** What the seller and lender pay toward closing costs. */
  credits: number;
}

/** The cash the buyer brings to closing, line by line, as the API works it out. */
export interface CashToClose {
  downPayment: number;
  loanCosts: number;
  otherFees: number;
  /** A day's interest at the note rate, to the cent. */
  dailyInterest: number;
  prepaidInterestDays: number;
  prepaidInterest: number;
  /** The first year's premium. */
  homeownersInsurance: number;
  /** A month of the first year's taxes and insurance, to the cent. */
  monthlyEscrow: number;
  escrowMonths: number;
  escrowDeposit: number;
  /** A buydown the buyer pays for; zero otherwise. */
  buydownCost: number;
  /** Discount points; zero without them. */
  discountPoints: number;
  /** An FHA upfront MIP or VA funding fee paid at closing; zero when financed or for a conventional loan. */
  upfrontMortgageFee: number;
  /** Everything besides the down payment, before credits. */
  closingCosts: number;
  /** The credits used: never more than the closing costs. */
  credits: number;
  /** Credits beyond the closing costs, which cannot pay the down payment. */
  unusedCredits: number;
  total: number;
}

/**
 * Who pays for a temporary buydown. Paid by the seller or builder, it saves the borrower its cost in interest; paid
 * by the borrower at closing, it only moves their money earlier.
 */
export type BuydownFunding = 'Seller' | 'Borrower';

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
  /** What a buydown's subsidy pays over this schedule; 0 without one. */
  buydownSubsidy: number;
  /** The interest the borrower pays: totalInterest, less the subsidy when the seller or builder pays for a buydown. */
  interestYouPay: number;
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
  /** Owed at the start of the year, on the plan with its extra payments; 0 once paid off. */
  loanBalance: number;
  /** The market value less what is owed. */
  equity: number;
}

export interface AmortizationResponse {
  purchase: Purchase;
  baseline: Schedule;
  accelerated: Schedule;
  savings: Savings;
  projection: YearProjection[];
  buydown: BuydownSummary | null;
  adjustableRate: AdjustableRateSummary | null;
  /** Null when the request had no closing costs. */
  cashToClose?: CashToClose | null;
  /** Null without discount points. */
  discountPoints?: DiscountPointsSummary | null;
  /** Null for a conventional loan. */
  program?: LoanProgramSummary | null;
}

export interface BuydownSummary {
  noteRate: number;
  /** Each bought-down year, then the first year at the note rate. */
  years: { year: number; annualInterestRate: number; monthlyPayment: number }[];
  totalSubsidy: number;
  paidBy: BuydownFunding;
}

/** An adjustable rate's worst case: rates rising as far and as fast as the caps allow. */
export interface AdjustableRateSummary {
  worstCaseRateChanges: RateChange[];
  worstCasePeakPayment: number;
  worstCaseTotalInterest: number;
}
