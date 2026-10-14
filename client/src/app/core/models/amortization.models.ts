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
  /** Weighs the ways to take the seller's money; needs closing costs, and not with an adjustable rate or points. */
  sellerOffer?: SellerOfferInput | null;
}

/** How to weigh the ways to take the seller's or builder's money. */
export interface SellerOfferInput {
  /** The years the loan is kept before selling or refinancing: each way is costed over them. */
  yearsKept: number;
  /** How much each discount point lowers the rate, in percentage points. */
  rateCutPerPoint: number;
}

/** A way to take a seller's or builder's offer. */
export type SellerOfferUse = 'PriceCut' | 'ClosingCosts' | 'TemporaryBuydown' | 'DiscountPoints';

/** The offer taken one way, on the standard schedule, costed over the years kept. */
export interface SellerOfferOption {
  use: SellerOfferUse;
  homePrice: number;
  loanAmount: number;
  annualInterestRate: number;
  /** The points the offer buys; zero for the other ways. */
  points: number;
  /** The first month's payment, housing costs included, less a buydown's subsidy. */
  firstPayment: number;
  /** The same month's payment without the subsidy, as once a buydown ends; the first payment otherwise. */
  laterPayment: number;
  cashToClose: number;
  /** Every payment over the years kept. */
  payments: number;
  /** What is still owed after them. */
  balance: number;
  /** The cash to close, the payments and the balance. */
  cost: number;
  /** The part of the offer the loan does not let pay the buyer's costs. */
  notUsed: number;
}

/** The seller's or builder's offer taken each way it can be. */
export interface SellerOfferComparison {
  /** Their credits, and a buydown they pay for. */
  offer: number;
  yearsKept: number;
  rateCutPerPoint: number;
  options: SellerOfferOption[];
  /** The way that costs the least over the years kept. */
  best: SellerOfferUse;
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
  /** FHA only: the decision credit score (580+ needs 3.5% down, 500 to 579 needs 10%); null for 580 or more. */
  creditScore?: number | null;
  /** FHA only: the county's five-digit FIPS code, whose loan limit the loan must be within; null not to check. */
  countyFips?: string | null;
}

/** HUD's FHA loan limits for one-unit homes, by county. */
export interface FhaLoanLimits {
  year: number;
  source: string;
  floor: number;
  ceiling: number;
  /** Each state's and territory's name, by its two-letter code. */
  states: Record<string, string>;
  counties: FhaCountyLimit[];
}

/** One county's FHA limit. */
export interface FhaCountyLimit {
  fips: string;
  state: string;
  name: string;
  limit: number;
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
  /** For FHA in a given county: "Bexar County, TX", its limit, and the year of HUD's table. */
  countyName?: string | null;
  countyLoanLimit?: number | null;
  loanLimitYear?: number | null;
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
  /** What the seller or builder pays toward closing costs, within the loan's limit. */
  credits: number;
  /** What the lender pays toward closing costs. */
  lenderCredits: number;
}

/** A higher conventional limit on what the seller may pay, and the down payment that reaches it. */
export interface ConcessionTier {
  downPayment: number;
  limitPercent: number;
  limit: number;
}

/**
 * What the seller or builder pays toward the buyer's costs, against the most the loan allows: conventional 3% of the
 * price with less than 10% down, 6% to 25% down, 9% from 25%; FHA 6%; VA 4%, besides the normal closing costs.
 */
export interface Concessions {
  limitPercent: number;
  limit: number;
  /** A buydown the seller pays for, which counts against the limit. */
  sellerBuydown: number;
  /** Everything the seller pays that counts against the limit. */
  total: number;
  /** How far that goes beyond the limit; the seller's credits are cut by as much. */
  overLimit: number;
  /** True for VA, whose limit leaves out the normal closing costs and points. */
  normalClosingCostsExcluded: boolean;
  /** For a conventional loan below 25% down, the down payment that raises the limit. */
  nextTier: ConcessionTier | null;
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
  /** The seller's credits used: within the closing costs the lender's leave, and the limit. */
  sellerCredits: number;
  /** The lender's credits used, before the seller's. */
  lenderCredits: number;
  /** All the credits used: never more than the closing costs. */
  credits: number;
  /** Credits beyond the closing costs, which cannot pay the down payment. */
  unusedCredits: number;
  total: number;
  concessions: Concessions;
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
  /** With PMI: when the other way of removing it would end it, and what asking at 80% saves. Null when both end together. */
  pmiOtherChoice?: { removal: MortgageInsuranceCancellation; endDate: string; savedByAsking: number } | null;
  /** The seller's offer taken each way; null unless asked for with an offer. */
  sellerOffer?: SellerOfferComparison | null;
}

export interface BuydownSummary {
  noteRate: number;
  /** Each bought-down year, then the first year at the note rate. */
  years: BuydownYear[];
  totalSubsidy: number;
  paidBy: BuydownFunding;
}

/** One year of a buydown: its rate, the principal and interest paid each month, and what the buydown pays that year. */
export interface BuydownYear {
  year: number;
  annualInterestRate: number;
  monthlyPayment: number;
  /** What the buydown pays that year, on the standard schedule; 0 once the loan is at its note rate. */
  subsidy: number;
}

/** An adjustable rate's worst case: rates rising as far and as fast as the caps allow. */
export interface AdjustableRateSummary {
  worstCaseRateChanges: RateChange[];
  worstCasePeakPayment: number;
  worstCaseTotalInterest: number;
}
