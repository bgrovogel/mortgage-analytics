import { FieldRules, MAX_AMOUNT } from '../../../core/forms/field-rules';

/** The 2026 IRA contribution limit. */
export const IRA_LIMIT = 7_500;

/** The most an employee can defer into a 401(k) in 2026, before catch-up contributions (the server's TaxLimits). */
export const EMPLOYEE_DEFERRAL_LIMIT = 24_500;

/** Every number on the strategy form: its label, and the limits the API enforces (StrategyRequestValidator). */
export const STRATEGY_RULES = {
  currentBalance: { label: 'Balance you owe', unit: '$', min: 0.01, max: MAX_AMOUNT },
  homeValue: { label: 'Home value', unit: '$', min: 0, max: MAX_AMOUNT },
  monthlyPmi: { label: 'PMI per month', unit: '$', min: 0, max: 10_000 },
  annualInterestRate: { label: 'Interest rate', unit: '%', min: 0, max: 30, decimals: 4 },
  yearsLeft: { label: 'Years left', unit: 'years', min: 1 / 12, max: 30 },
  monthlyCashToPutToWork: { label: 'Cash each month', unit: '$', min: 0, max: MAX_AMOUNT },
  grossAnnualIncome: { label: 'Gross income', unit: '$', min: 0, max: MAX_AMOUNT },
  marginalTaxRate: { label: 'Tax rate', unit: '%', min: 0, max: 60 },
  otherItemizedDeductions: { label: 'Other deductions', unit: '$', min: 0, max: MAX_AMOUNT },
  capitalGainsTaxRate: { label: 'Capital gains (federal + state)', unit: '%', min: 0, max: 60 },
  employerMatchPercent: { label: 'Employer match', unit: '%', min: 0, max: 200 },
  matchUpToPercentOfPay: { label: 'Matched share of pay', unit: '%', min: 0, max: 100 },
  annualIraContribution: { label: 'IRA contributions', unit: '$', min: 0, max: IRA_LIMIT },
  currentRetirementSavings: { label: '401(k)s today', unit: '$', min: 0, max: MAX_AMOUNT },
  currentInvestments: { label: 'Other investments today', unit: '$', min: 0, max: MAX_AMOUNT },
  annualRsuVesting: { label: 'RSUs vesting', unit: '$', min: 0, max: MAX_AMOUNT },
  annualEsopContribution: { label: 'ESOP', unit: '$', min: 0, max: MAX_AMOUNT },
  esppContributionPercent: { label: 'ESPP contribution', unit: '%', min: 0, max: 25 },
  esppDiscountPercent: { label: 'ESPP discount', unit: '%', min: 0, max: 15 },
  esppPurchasePeriodMonths: { label: 'ESPP purchase period', unit: 'months', min: 1, max: 27, whole: true },
  expectedAnnualReturn: { label: 'Stock return', unit: '%', min: -10, max: 30 },
  inflationRate: { label: 'Inflation', unit: '%', min: -5, max: 20 },
  homeGrowthRate: { label: 'Home value growth', unit: '%', min: -20, max: 25 },
} as const satisfies FieldRules;

export type StrategyNumberField = keyof typeof STRATEGY_RULES;
