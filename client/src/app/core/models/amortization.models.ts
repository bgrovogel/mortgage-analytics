/**
 * TypeScript mirrors of the API contracts (MortgageAnalytics.Application.Contracts).
 * The Swagger document at /swagger/v1/swagger.json is the source of truth.
 */

import type { TaxFilingStatus } from './strategy.models';

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
  /** How the buyer will use the home; a home they live in when left out (requests saved before it was asked). */
  occupancy?: OccupancyType;
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
  /** A household's income and debts, to measure the home against; leave out for none. */
  affordability?: AffordabilityInput | null;
  /** What the household wants to pay each month, all in; the response says the highest price it reaches. Needs no income. */
  monthlyBudget?: number | null;
  /** Weighs buying the home against renting a similar one; leave out for none. */
  rentOrBuy?: RentOrBuyInput | null;
  /** What selling would leave at the end of each year; leave out for none. */
  sale?: SaleInput | null;
  /** Lets the home out and measures it as an investment; leave out for none. */
  rental?: RentalInput | null;
  /** Borrows part of the price as a second loan instead of paying PMI, and compares the two; leave out for none. */
  secondLoan?: SecondLoanInput | null;
}

/** A second loan taken with the first, behind it. */
export interface SecondLoanInput {
  /** The amount borrowed as a second loan; less than what the request already borrows. */
  amount: number;
  /** Its yearly interest rate, as a percentage, fixed for its term. */
  annualInterestRate: number;
  /** Its term, in months: 12 to 360. */
  termInMonths: number;
  /** The years the loans are kept, for comparing what each way costs. */
  yearsKept: number;
}

/** One way of borrowing: with PMI on one loan, or a smaller first loan and a second. */
export interface SecondLoanOption {
  firstLoan: number;
  /** 0 for none. */
  secondLoan: number;
  firstLoanPayment: number;
  secondLoanPayment: number;
  /** The first month's PMI; 0 when the first loan needs none. */
  mortgageInsurance: number;
  /** The first month, all in: both loans, taxes, insurance, dues and PMI. */
  monthlyPayment: number;
  cashToClose: number;
  /** Every payment in the years kept, for both loans. */
  payments: number;
  /** What both loans still owe at the end of the years kept. */
  balance: number;
  /** The cash to close, the payments and the balance: what the buyer pays. */
  cost: number;
}

/** A second loan against paying PMI, over the years the loans are kept. */
export interface SecondLoanComparison extends SecondLoanInput {
  withMortgageInsurance: SecondLoanOption;
  withSecondLoan: SecondLoanOption;
  /** What the second loan saves over the years kept; negative when it costs more. */
  saved: number;
}

/** What letting the home out would bring in, and cost besides owning it. */
export interface RentalInput {
  monthlyRent: number;
  /** The share of the rent lost to empty months and unpaid rent, as a percentage. */
  vacancyPercent: number;
  /** What a property manager is paid, as a percentage of the rent collected. */
  managementPercent: number;
  /** Repairs and upkeep a year, as a percentage of the home's value. */
  maintenancePercent: number;
  /** How much the rent rises each year, as a percentage. */
  rentIncreasePercent: number;
}

/** One year of letting the home out. */
export interface RentalYear {
  year: number;
  grossRent: number;
  vacancyLoss: number;
  managementFee: number;
  maintenance: number;
  /** Property taxes, assessments, insurance and dues. */
  operatingCosts: number;
  netOperatingIncome: number;
  /** The loan's payments: principal, interest and mortgage insurance. */
  debtService: number;
  /** What is left after the loan; negative when the owner has to add money. */
  cashFlow: number;
}

/** The home let out, measured as an investment, year by year. */
export interface RentalOutcome extends RentalInput {
  /** What the buyer puts in at closing. */
  cashInvested: number;
  capRatePercent: number;
  /** Null when no cash was put in. */
  cashOnCashPercent: number | null;
  /** Null without a loan. */
  debtServiceCoverage: number | null;
  grossRentMultiplier: number;
  rentToPricePercent: number;
  breakEvenMonthlyRent: number;
  years: RentalYear[];
}

/** How a sale is weighed: what it costs, and how the gain is taxed. */
export interface SaleInput {
  /** What selling costs, as a percentage of the home's value then. */
  sellingCostPercent: number;
  /** How the seller files, which sets the gain a home lived in shelters from tax. */
  filingStatus: TaxFilingStatus;
  /** The federal rate on a long-term capital gain, as a percentage. */
  gainsTaxRatePercent: number;
  /** Yearly changes in the home's value to work the sale out under as well as the plan's, up to three: for example -3 and 0. */
  valueChangesPercent?: number[];
}

/** Selling at the end of one year. */
export interface SaleYear {
  year: number;
  homeValue: number;
  /** What is owed then, on the plan with its extra payments. */
  loanBalance: number;
  sellingCosts: number;
  /** The sale less its costs, over the price paid; negative for a loss. */
  gain: number;
  /** The part of the gain the exclusion shelters. */
  taxFreeGain: number;
  taxOnGain: number;
  /** What is left after the loan, the costs and the tax; negative when the sale does not cover them. */
  netProceeds: number;
}

/** What selling would leave in hand, for each year it might be sold. */
export interface SaleOutcome {
  sellingCostPercent: number;
  gainsTaxRatePercent: number;
  /** The gain a sale could shelter from tax after two years: $250,000, $500,000 for a couple filing jointly, nothing for a home not lived in. */
  exclusionPerSale: number;
  /** Each year of the loan, with the home's value changing as the plan says. */
  years: SaleYear[];
  /** The same sale if the home's value changed by other yearly rates, in the order they were asked for; empty when none were. */
  scenarios: SaleScenario[];
}

/** The sale with the home's value changing by one yearly rate instead of the plan's. */
export interface SaleScenario {
  /** The change in the home's value each year, as a percentage; negative for a fall. */
  yearlyChangePercent: number;
  years: SaleYear[];
}

/** What renting a similar home would cost, and what money does meanwhile. */
export interface RentOrBuyInput {
  monthlyRent: number;
  /** How much the rent rises each year, as a percentage. */
  rentIncreasePercent: number;
  /** What money invested earns a year, as a percentage. */
  investmentReturnPercent: number;
  /** Upkeep a year, as a percentage of the home's value. */
  maintenancePercent: number;
  /** What selling costs, as a percentage of the home's value then. */
  sellingCostPercent: number;
  /** How the owner's federal income tax differs from a renter's; left out to leave tax out. */
  ownerTaxes?: OwnerTaxesInput | null;
  /** Yearly changes in the home's value to weigh buying under as well as the plan's, up to three: for example -3 and 0. */
  valueChangesPercent?: number[];
}

/** How a household files and what else it deducts, for the tax owning saves over renting. */
export interface OwnerTaxesInput {
  filingStatus: TaxFilingStatus;
  /** The federal rate on the last dollars of income, as a percentage. */
  marginalTaxRatePercent: number;
  /** State and other local taxes a year besides this home's property tax, in today's dollars. */
  otherStateAndLocalTaxes: number;
  /** Charity and other itemized deductions a year, in today's dollars. */
  otherItemizedDeductions: number;
}

/** One year of renting instead of buying. */
export interface RentOrBuyYear {
  year: number;
  /** What owning cost that year: payments, housing costs and upkeep. */
  ownershipCost: number;
  rent: number;
  /** What selling would leave: the value, less what is owed and selling costs. */
  homeEquity: number;
  buyerInvestments: number;
  buyerNetWorth: number;
  renterNetWorth: number;
  /** How far buying is ahead; negative while renting is. */
  advantage: number;
  /** The federal income tax owning saved that year, which the buyer invests; zero when tax is left out. */
  taxSaved?: number;
}

/** Buying the home against renting a similar one, year by year. */
export interface RentOrBuyComparison extends RentOrBuyInput {
  /** What buying takes at closing, which the renter invests instead. */
  cashToClose: number;
  /** The first year from which buying is ahead for good; null when it never is. */
  breakEvenYear: number | null;
  years: RentOrBuyYear[];
  /** True when the tax owning saves is counted. */
  countsTaxSavings?: boolean;
  /** The same comparison if the home's value changed by other yearly rates, in the order asked; empty when none were. */
  scenarios: RentOrBuyScenario[];
}

/** Buying against renting if the home's value changed by one yearly rate. */
export interface RentOrBuyScenario {
  yearlyChangePercent: number;
  /** The first year from which buying is ahead for good under it; null when it never is. */
  breakEvenYear: number | null;
  years: RentOrBuyYear[];
}

/** What a monthly budget buys: the highest price whose payment fits it, keeping the down payment share, rate and costs. */
export interface BudgetAnswer {
  monthlyBudget: number;
  /** The highest whole-dollar price within the budget; 0 when none is. */
  maxHomePrice: number;
  downPayment: number;
}

/** The buyers' gross income and other debts: the first buyer's, with each co-buyer's counted alongside. */
export interface AffordabilityInput {
  annualIncome: number;
  /** Car, student and personal loans, card minimums, support: not rent, utilities or this home. */
  monthlyDebts: number;
  /** Others on the loan; left out when the first buyer buys alone. */
  coBuyers?: CoBuyerInput[];
}

/** Someone buying with the first buyer. */
export interface CoBuyerInput {
  annualIncome: number;
  monthlyDebts: number;
  /** The share of the down payment they put in, as a percentage; the first buyer puts in the rest. */
  downPaymentPercent: number;
}

/** One debt-to-income limit, and what it allows. */
export interface AffordabilityLimit {
  /** The most of income for housing; null when only the total is limited. */
  housingPercent: number | null;
  totalPercent: number;
  maxHousingPayment: number;
  /** The highest price within it, with the same down payment share and costs; 0 when none is. */
  maxHomePrice: number;
  /** True when this home's payment is within it. */
  fits: boolean;
}

/** The home against a household's income and debts. */
export interface Affordability {
  monthlyIncome: number;
  monthlyDebts: number;
  /** This home's payment as a lender counts it: at the qualifying rate, with every housing cost. */
  housingPayment: number;
  housingPercent: number;
  totalPercent: number;
  /** The classic 28% and 36%. */
  comfortable: AffordabilityLimit;
  /** The program's: conventional 45% in all, FHA 31% and 43%, VA 41% in all. */
  mostAllowed: AffordabilityLimit;
  /** The rate the principal and interest are qualified at, here and at every highest price. */
  qualifyingRate: number;
  /** Why: the note rate, or an adjustable rate's program rule. */
  qualifyingRateBasis: QualifyingRateBasis;
  /** Each buyer, the first first, when there are co-buyers; otherwise null. */
  buyers?: Buyer[] | null;
}

/** One of the buyers: what they bring, and the share of the payment that follows their income. */
export interface Buyer {
  monthlyIncome: number;
  monthlyDebts: number;
  downPaymentPercent: number;
  /** Their share of the down payment in dollars; every buyer's adds up to it. */
  downPayment: number;
  /** Their share of the first month's payment, split in proportion to income; every buyer's adds up to it. */
  monthlyPayment: number;
}

/**
 * Why a loan is qualified at its rate: the note rate; a conventional ARM fixed three years or less, at the most it
 * reaches in five years; one fixed five years, at its first change's cap or the fully indexed rate; an FHA 1-year ARM
 * with under 5% down, a point above its start.
 */
export type QualifyingRateBasis = 'NoteRate' | 'MostInFirstFiveYears' | 'FirstResetOrFullyIndexed' | 'StartPlusOnePoint';

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

/**
 * How the buyer will use the home. A second home or an investment property allows a smaller conventional loan (90%
 * or 85% of the price), no FHA or VA loan and no homestead; an investment property also a 2% seller contribution.
 */
export type OccupancyType = 'PrimaryResidence' | 'SecondHome' | 'InvestmentProperty';

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
  /** FHFA's conforming loan limit for the year the loan closes. */
  conformingLoanLimit: number;
  /** A conventional loan above that limit: stricter rules and its own rates. */
  isJumbo: boolean;
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
  /** The home against the household's income and debts; null unless they are given. */
  affordability?: Affordability | null;
  /** The highest price a monthly budget reaches; null unless a budget was given. */
  budget?: BudgetAnswer | null;
  /** Buying against renting; null unless asked. */
  rentOrBuy?: RentOrBuyComparison | null;
  /** What selling would leave at the end of each year; null unless asked. */
  sale?: SaleOutcome | null;
  /** The home let out, measured as an investment; null unless asked. */
  rental?: RentalOutcome | null;
  /** A second loan against paying PMI; null unless asked. */
  secondLoan?: SecondLoanComparison | null;
  /** The rate counting the lender's costs, prepaid interest, points and mortgage insurance; null when nothing was received. */
  annualPercentageRate?: number | null;
  /** A Loan Estimate's "in 5 years" on the standard schedule: what the first 60 payments come to and the principal they pay off. */
  inFiveYears?: { totalPaid: number; principalPaidOff: number } | null;
  /** The interest over the whole loan as a percentage of the amount borrowed, to a thousandth. */
  totalInterestPercentage?: number | null;
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
