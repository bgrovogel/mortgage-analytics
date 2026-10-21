import { FieldRules, MAX_AMOUNT } from '../../../core/forms/field-rules';
import { t } from '../../../core/i18n/i18n';

/** The longest loan, in years. */
export const MAX_YEARS = 50;

/** Years left as the calculator's whole-year term: 270 months (22.5 years) becomes 23. */
export const wholeYearsOf = (months: number) => Math.max(1, Math.round(months / 12));

/**
 * Every number on the calculator form, with the limits the API enforces (AmortizationRequestValidator). Optional
 * fields may be left blank, which counts as nothing (no tax, no extra payment). Limits that depend on other
 * fields (an extra payment no larger than the loan, a payment number within the term) are left to the API.
 */
export const LOAN_RULES = {
  homePrice: { get label() { return t('Home price'); }, unit: '$', min: 0.01 },
  downPayment: { get label() { return t('Down payment'); }, unit: '$', min: 0 },
  annualInterestRate: { get label() { return t('Interest rate'); }, unit: '%', min: 0, max: 30, decimals: 4 },
  termYears: { get label() { return t('Term'); }, unit: 'years', min: 1, max: MAX_YEARS, whole: true },
  monthlyExtra: { get label() { return t('Extra principal every month'); }, unit: '$', min: 0, optional: true },

  propertyTaxRate: { get label() { return t('Property tax rate'); }, unit: '%', min: 0, max: 15, decimals: 4, optional: true },
  propertyTaxHomesteadExemption: { get label() { return t('Homestead exemption'); }, unit: '$', min: 0, max: 10_000_000, optional: true },
  schoolTaxRate: { get label() { return t('School tax rate'); }, unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  localTaxRate: { get label() { return t('County/city tax rate'); }, unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  mudTaxRate: { get label() { return t('MUD tax rate'); }, unit: '%', min: 0, max: 5, decimals: 4, optional: true },
  pidAnnual: { get label() { return t('PID per year'); }, unit: '$', min: 0, max: 1_000_000, optional: true },
  pidYears: { get label() { return t('PID years left'); }, unit: 'years', min: 1, max: 50, whole: true, optional: true },
  schoolHomesteadExemption: { get label() { return t('School exemption'); }, unit: '$', min: 0, max: 10_000_000, optional: true },
  localHomesteadExemptionPercent: { get label() { return t('County/city exemption'); }, unit: '%', min: 0, max: 100, decimals: 4, optional: true },
  mudHomesteadExemptionPercent: { get label() { return t('MUD exemption'); }, unit: '%', min: 0, max: 100, decimals: 4, optional: true },
  homesteadAssessmentCap: { get label() { return t('Appraisal cap'); }, unit: '%', min: 0, max: 100, decimals: 4, optional: true },
  over65Year: { get label() { return t('Qualifying year'); }, unit: 'number', min: 1, max: MAX_YEARS, whole: true, optional: true },
  over65SchoolExemption: { get label() { return t('Extra school exemption'); }, unit: '$', min: 0, max: 10_000_000, optional: true },
  transferredCeilingPercent: { get label() { return t('Share paid before'); }, unit: '%', min: 0.01, max: 100, decimals: 4, optional: true },
  over65LocalExemption: { get label() { return t('Extra county/city exemption'); }, unit: '$', min: 0, max: 10_000_000, optional: true },

  annualInsurance: { get label() { return t('Home insurance'); }, unit: '$', min: 0, max: 1_000_000, optional: true },
  monthlyHoa: { get label() { return t('HOA dues'); }, unit: '$', min: 0, max: 100_000, optional: true },
  pmiRate: { get label() { return t('PMI rate'); }, unit: '%', min: 0, max: 5, decimals: 4, optional: true },

  homeValueGrowthRate: { get label() { return t('Home value growth'); }, unit: '%', min: -20, max: 25, decimals: 4, optional: true },
  insuranceIncreaseRate: { get label() { return t('Insurance increase'); }, unit: '%', min: -20, max: 50, decimals: 4, optional: true },
  hoaIncreaseRate: { get label() { return t('HOA increase'); }, unit: '%', min: -20, max: 50, decimals: 4, optional: true },

  creditScore: { get label() { return t('Credit score'); }, unit: 'number', min: 300, max: 850, whole: true, optional: true },
  points: { get label() { return t('Points'); }, unit: 'number', min: 0.001, max: 5, decimals: 3, optional: true },
  rateWithoutPoints: { get label() { return t('Rate without points'); }, unit: '%', min: 0, max: 30, decimals: 4, optional: true },

  loanCosts: { get label() { return t('Loan costs'); }, unit: '$', min: 0, max: 1_000_000, optional: true },
  otherFees: { get label() { return t('Other fees'); }, unit: '$', min: 0, max: 1_000_000, optional: true },
  prepaidInterestDays: { get label() { return t('Days of prepaid interest'); }, unit: 'number', min: 0, max: 31, whole: true, optional: true },
  escrowMonths: { get label() { return t('Months of escrow'); }, unit: 'months', min: 0, max: 14, whole: true, optional: true },
  closingCredits: { get label() { return t('Seller credits'); }, unit: '$', min: 0, max: 1_000_000, optional: true },
  lenderCredits: { get label() { return t('Lender credits'); }, unit: '$', min: 0, max: 1_000_000, optional: true },
  annualIncome: { get label() { return t('Household income a year'); }, unit: '$', min: 0.01, max: 100_000_000, optional: true },
  monthlyDebts: { get label() { return t('Other debts a month'); }, unit: '$', min: 0, max: 8_333_333, optional: true },
  monthlyBudget: { get label() { return t('What you want to pay a month'); }, unit: '$', min: 0.01, max: 1_000_000, optional: true },

  annualExtra: { get label() { return t('Extra once a year'); }, unit: '$', min: 0, max: MAX_AMOUNT, optional: true },
  annualFirstPayment: { get label() { return t('First yearly payment'); }, unit: 'number', min: 1, max: MAX_YEARS * 12, whole: true, optional: true },
  recastMinimum: { get label() { return t('Recast minimum'); }, unit: '$', min: 1_000, max: MAX_AMOUNT, optional: true },
  recastFee: { get label() { return t('Recast fee'); }, unit: '$', min: 0, max: 10_000, optional: true },
} as const satisfies FieldRules;

/** The numbers in each tax-rate-change row: the year, and a new rate for each tax (blank keeps it). */
export const RATE_CHANGE_RULES = {
  fromYear: { get label() { return t('Rate change year'); }, unit: 'number', min: 2, max: MAX_YEARS, whole: true },
  propertyTaxRate: { get label() { return t('New property tax rate'); }, unit: '%', min: 0, max: 15, decimals: 4, optional: true },
  schoolTaxRate: { get label() { return t('New school tax rate'); }, unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  localTaxRate: { get label() { return t('New county/city tax rate'); }, unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  mudTaxRate: { get label() { return t('New MUD tax rate'); }, unit: '%', min: 0, max: 5, decimals: 4, optional: true },
} as const satisfies FieldRules;

/** The three numbers in each co-buyer row. A row with no income yet counts for nothing, so the form is not held up by it. */
export const CO_BUYER_RULES = {
  annualIncome: { get label() { return t('Co-buyer income'); }, unit: '$', min: 0.01, max: 100_000_000, optional: true },
  monthlyDebts: { get label() { return t('Co-buyer debts'); }, unit: '$', min: 0, max: 8_333_333, optional: true },
  downPaymentPercent: { get label() { return t('Share of the down payment'); }, unit: '%', min: 0, max: 100 },
} as const satisfies FieldRules;

/** The most co-buyers on a loan, besides the first buyer: the API's limit. */
export const MAX_CO_BUYERS = 3;

/** The two numbers in each lump-sum row. */
export const LUMP_SUM_RULES = {
  amount: { get label() { return t('Lump sum'); }, unit: '$', min: 0.01, max: MAX_AMOUNT },
  paymentNumber: { get label() { return t('Lump sum payment number'); }, unit: 'number', min: 1, max: MAX_YEARS * 12, whole: true },
} as const satisfies FieldRules;
