import { FieldRules, MAX_AMOUNT } from '../../../core/forms/field-rules';
import { t } from '../../../core/i18n/i18n';

/** The 2026 IRA contribution limit. */
export const IRA_LIMIT = 7_500;

/** The most an employee can defer into a 401(k) in 2026, before catch-up contributions (the server's TaxLimits). */
export const EMPLOYEE_DEFERRAL_LIMIT = 24_500;

/** Every number on the strategy form: its label, and the limits the API enforces (StrategyRequestValidator). */
export const STRATEGY_RULES = {
  currentBalance: { get label() { return t('Balance you owe'); }, unit: '$', min: 0.01, max: MAX_AMOUNT },
  homeValue: { get label() { return t('Home value'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  monthlyPmi: { get label() { return t('PMI per month'); }, unit: '$', min: 0, max: 10_000 },
  annualInterestRate: { get label() { return t('Interest rate'); }, unit: '%', min: 0, max: 30, decimals: 4 },
  yearsLeft: { get label() { return t('Years left'); }, unit: 'years', min: 1 / 12, max: 30 },
  monthlyCashToPutToWork: { get label() { return t('Cash each month'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  grossAnnualIncome: { get label() { return t('Gross income'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  marginalTaxRate: { get label() { return t('Tax rate'); }, unit: '%', min: 0, max: 60 },
  otherItemizedDeductions: { get label() { return t('Other deductions'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  capitalGainsTaxRate: { get label() { return t('Capital gains (federal + state)'); }, unit: '%', min: 0, max: 60 },
  employerMatchPercent: { get label() { return t('Employer match'); }, unit: '%', min: 0, max: 200 },
  matchUpToPercentOfPay: { get label() { return t('Matched share of pay'); }, unit: '%', min: 0, max: 100 },
  annualIraContribution: { get label() { return t('IRA contributions'); }, unit: '$', min: 0, max: IRA_LIMIT },
  currentRetirementSavings: { get label() { return t('401(k)s today'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  currentInvestments: { get label() { return t('Other investments today'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  annualRsuVesting: { get label() { return t('RSUs vesting'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  annualEsopContribution: { get label() { return t('ESOP'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  esppContributionPercent: { get label() { return t('ESPP contribution'); }, unit: '%', min: 0, max: 25 },
  esppDiscountPercent: { get label() { return t('ESPP discount'); }, unit: '%', min: 0, max: 15 },
  esppPurchasePeriodMonths: { get label() { return t('ESPP purchase period'); }, unit: 'months', min: 1, max: 27, whole: true },
  expectedAnnualReturn: { get label() { return t('Stock return'); }, unit: '%', min: -10, max: 30 },
  inflationRate: { get label() { return t('Inflation'); }, unit: '%', min: -5, max: 20 },
  homeGrowthRate: { get label() { return t('Home value growth'); }, unit: '%', min: -20, max: 25 },
} as const satisfies FieldRules;

export type StrategyNumberField = keyof typeof STRATEGY_RULES;
