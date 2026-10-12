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

  propertyTaxRate: { label: 'Property tax rate', unit: '%', min: 0, max: 15, decimals: 4, optional: true },
  propertyTaxHomesteadExemption: { label: 'Homestead exemption', unit: '$', min: 0, max: 10_000_000, optional: true },
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
  transferredCeilingPercent: { label: 'Share paid before', unit: '%', min: 0.01, max: 100, decimals: 4, optional: true },
  over65LocalExemption: { label: 'Extra county/city exemption', unit: '$', min: 0, max: 10_000_000, optional: true },

  annualInsurance: { label: 'Home insurance', unit: '$', min: 0, max: 1_000_000, optional: true },
  monthlyHoa: { label: 'HOA dues', unit: '$', min: 0, max: 100_000, optional: true },
  pmiRate: { label: 'PMI rate', unit: '%', min: 0, max: 5, decimals: 4, optional: true },

  homeValueGrowthRate: { label: 'Home value growth', unit: '%', min: -20, max: 25, decimals: 4, optional: true },
  insuranceIncreaseRate: { label: 'Insurance increase', unit: '%', min: -20, max: 50, decimals: 4, optional: true },
  hoaIncreaseRate: { label: 'HOA increase', unit: '%', min: -20, max: 50, decimals: 4, optional: true },

  creditScore: { label: 'Credit score', unit: 'number', min: 300, max: 850, whole: true, optional: true },
  points: { label: 'Points', unit: 'number', min: 0.001, max: 5, decimals: 3, optional: true },
  rateWithoutPoints: { label: 'Rate without points', unit: '%', min: 0, max: 30, decimals: 4, optional: true },

  loanCosts: { label: 'Loan costs', unit: '$', min: 0, max: 1_000_000, optional: true },
  otherFees: { label: 'Other fees', unit: '$', min: 0, max: 1_000_000, optional: true },
  prepaidInterestDays: { label: 'Days of prepaid interest', unit: 'number', min: 0, max: 31, whole: true, optional: true },
  escrowMonths: { label: 'Months of escrow', unit: 'months', min: 0, max: 14, whole: true, optional: true },
  closingCredits: { label: 'Seller and lender credits', unit: '$', min: 0, max: 1_000_000, optional: true },

  annualExtra: { label: 'Extra once a year', unit: '$', min: 0, max: MAX_AMOUNT, optional: true },
  annualFirstPayment: { label: 'First yearly payment', unit: 'number', min: 1, max: MAX_YEARS * 12, whole: true, optional: true },
  recastMinimum: { label: 'Recast minimum', unit: '$', min: 1_000, max: MAX_AMOUNT, optional: true },
  recastFee: { label: 'Recast fee', unit: '$', min: 0, max: 10_000, optional: true },
} as const satisfies FieldRules;

/** The numbers in each tax-rate-change row: the year, and a new rate for each tax (blank keeps it). */
export const RATE_CHANGE_RULES = {
  fromYear: { label: 'Rate change year', unit: 'number', min: 2, max: MAX_YEARS, whole: true },
  propertyTaxRate: { label: 'New property tax rate', unit: '%', min: 0, max: 15, decimals: 4, optional: true },
  schoolTaxRate: { label: 'New school tax rate', unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  localTaxRate: { label: 'New county/city tax rate', unit: '%', min: 0, max: 10, decimals: 4, optional: true },
  mudTaxRate: { label: 'New MUD tax rate', unit: '%', min: 0, max: 5, decimals: 4, optional: true },
} as const satisfies FieldRules;

/** The two numbers in each lump-sum row. */
export const LUMP_SUM_RULES = {
  amount: { label: 'Lump sum', unit: '$', min: 0.01, max: MAX_AMOUNT },
  paymentNumber: { label: 'Lump sum payment number', unit: 'number', min: 1, max: MAX_YEARS * 12, whole: true },
} as const satisfies FieldRules;
