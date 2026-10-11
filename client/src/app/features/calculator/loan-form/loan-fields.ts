import { FieldRules, MAX_AMOUNT } from '../../../core/forms/field-rules';

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
  homePrice: { label: 'Home price', unit: '$', min: 0.01 },
  downPayment: { label: 'Down payment', unit: '$', min: 0 },
  annualInterestRate: { label: 'Interest rate', unit: '%', min: 0, max: 30, decimals: 4 },
  termYears: { label: 'Term', unit: 'years', min: 1, max: MAX_YEARS, whole: true },
  monthlyExtra: { label: 'Extra principal every month', unit: '$', min: 0, optional: true },

  schoolTaxRate: { label: 'School tax rate', unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  localTaxRate: { label: 'County/city tax rate', unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  mudTaxRate: { label: 'MUD tax rate', unit: '%', min: 0, max: 5, decimals: 4, optional: true },
  pidAnnual: { label: 'PID per year', unit: '$', min: 0, max: 1_000_000, optional: true },
  pidYears: { label: 'PID years left', unit: 'years', min: 1, max: 50, whole: true, optional: true },
  schoolHomesteadExemption: { label: 'School exemption', unit: '$', min: 0, max: 10_000_000, optional: true },
  localHomesteadExemptionPercent: { label: 'County/city exemption', unit: '%', min: 0, max: 100, decimals: 4, optional: true },
  mudHomesteadExemptionPercent: { label: 'MUD exemption', unit: '%', min: 0, max: 100, decimals: 4, optional: true },
  homesteadAssessmentCap: { label: 'Appraisal cap', unit: '%', min: 0, max: 100, decimals: 4, optional: true },
  over65Year: { label: 'Qualifying year', unit: 'number', min: 1, max: MAX_YEARS, whole: true, optional: true },
  over65SchoolExemption: { label: 'Extra school exemption', unit: '$', min: 0, max: 10_000_000, optional: true },
  over65LocalExemption: { label: 'Extra county/city exemption', unit: '$', min: 0, max: 10_000_000, optional: true },

  annualInsurance: { label: 'Home insurance', unit: '$', min: 0, max: 1_000_000, optional: true },
  monthlyHoa: { label: 'HOA dues', unit: '$', min: 0, max: 100_000, optional: true },
  pmiRate: { label: 'PMI rate', unit: '%', min: 0, max: 5, decimals: 4, optional: true },

  homeValueGrowthRate: { label: 'Home value growth', unit: '%', min: -20, max: 25, decimals: 4, optional: true },
  insuranceIncreaseRate: { label: 'Insurance increase', unit: '%', min: -20, max: 50, decimals: 4, optional: true },
  hoaIncreaseRate: { label: 'HOA increase', unit: '%', min: -20, max: 50, decimals: 4, optional: true },

  annualExtra: { label: 'Extra once a year', unit: '$', min: 0, max: MAX_AMOUNT, optional: true },
  annualFirstPayment: { label: 'First yearly payment', unit: 'number', min: 1, max: MAX_YEARS * 12, whole: true, optional: true },
  recastMinimum: { label: 'Recast minimum', unit: '$', min: 1_000, max: MAX_AMOUNT, optional: true },
  recastFee: { label: 'Recast fee', unit: '$', min: 0, max: 10_000, optional: true },
} as const satisfies FieldRules;

/** The adjustable rate's numbers: where resets are expected to go, and the caps on them (AdjustableRateRequest). */
export const ARM_RULES = {
  armExpectedRate: { label: 'Rate after the fixed period', unit: '%', min: 0, max: 30, decimals: 4 },
  armInitialCap: { label: 'First reset cap', unit: '%', min: 0, max: 10 },
  armPeriodicCap: { label: 'Later reset cap', unit: '%', min: 0, max: 10 },
  armLifetimeCap: { label: 'Lifetime cap', unit: '%', min: 0, max: 10 },
} as const satisfies FieldRules;

/** The usual temporary buydowns: points off the note rate in each year, year 1 first. */
export const BUYDOWNS = [
  { value: '1-0', label: '1-0 (1 point off in year 1)', reductions: [1] },
  { value: '2-1', label: '2-1 (2 points off, then 1)', reductions: [2, 1] },
  { value: '3-2-1', label: '3-2-1 (3, 2, then 1 off)', reductions: [3, 2, 1] },
  { value: '1-1', label: '1-1 (1 point off for 2 years)', reductions: [1, 1] },
] as const;

export type BuydownPlan = (typeof BUYDOWNS)[number]['value'];

/** The usual adjustable rates: how long the starting rate lasts, and how often it resets after that. */
export const ARM_TYPES = [
  { value: '5/1', fixedMonths: 60, intervalMonths: 12 },
  { value: '7/1', fixedMonths: 84, intervalMonths: 12 },
  { value: '10/1', fixedMonths: 120, intervalMonths: 12 },
  { value: '5/6', fixedMonths: 60, intervalMonths: 6 },
  { value: '7/6', fixedMonths: 84, intervalMonths: 6 },
  { value: '10/6', fixedMonths: 120, intervalMonths: 6 },
] as const;

export type ArmType = (typeof ARM_TYPES)[number]['value'];

/** How the rate works: fixed for the whole loan, bought down for the first years, or adjustable. */
export type RateType = 'fixed' | 'buydown' | 'arm';

/** The two numbers in each lump-sum row. */
export const LUMP_SUM_RULES = {
  amount: { label: 'Lump sum', unit: '$', min: 0.01, max: MAX_AMOUNT },
  paymentNumber: { label: 'Lump sum payment number', unit: 'number', min: 1, max: MAX_YEARS * 12, whole: true },
} as const satisfies FieldRules;
