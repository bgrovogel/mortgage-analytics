import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** The largest dollar amount the API accepts in any field. */
export const MAX_AMOUNT = 100_000_000;

/** The 2026 IRA contribution limit. */
export const IRA_LIMIT = 7_500;

/** Every number on the strategy form: its label, and the limits the API enforces (StrategyRequestValidator). */
export const NUMBER_FIELDS = {
  currentBalance: { label: 'Balance you owe', unit: '$', min: 0.01, max: MAX_AMOUNT },
  annualInterestRate: { label: 'Interest rate', unit: '%', min: 0, max: 30 },
  yearsLeft: { label: 'Years left', unit: 'years', min: 1 / 12, max: 30 },
  homeValue: { label: 'Home value', unit: '$', min: 0, max: MAX_AMOUNT },
  monthlyCashToPutToWork: { label: 'Cash each month', unit: '$', min: 0, max: MAX_AMOUNT },
  grossAnnualIncome: { label: 'Gross income', unit: '$', min: 0, max: MAX_AMOUNT },
  marginalTaxRate: { label: 'Tax rate', unit: '%', min: 0, max: 60 },
  otherItemizedDeductions: { label: 'Other deductions', unit: '$', min: 0, max: MAX_AMOUNT },
  capitalGainsTaxRate: { label: 'Capital gains tax rate', unit: '%', min: 0, max: 60 },
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
} as const satisfies Record<string, FieldRule>;

export type NumberField = keyof typeof NUMBER_FIELDS;

interface FieldRule {
  label: string;
  unit: '$' | '%' | 'years' | 'months';
  min: number;
  max: number;
  /** True when only whole numbers make sense. */
  whole?: boolean;
}

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** "$0 and $7,500", "0% and 60%", "1 month and 30 years". */
function range(rule: FieldRule): string {
  switch (rule.unit) {
    case '$':
      return `${usd.format(rule.min < 1 ? 0 : rule.min)} and ${usd.format(rule.max)}`;
    case '%':
      return `${plain.format(rule.min)}% and ${plain.format(rule.max)}%`;
    case 'years':
      return `1 month and ${plain.format(rule.max)} years`;
    case 'months':
      return `${rule.min} and ${rule.max} months`;
  }
}

/** The validators for a field: required, a number, and within its limits (whole when it must be). */
export function validatorsFor(field: NumberField): ValidatorFn[] {
  const rule: FieldRule = NUMBER_FIELDS[field];
  const whole: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
    control.value === null || Number.isInteger(control.value) ? null : { whole: true };
  return [Validators.required, Validators.min(rule.min), Validators.max(rule.max), ...(rule.whole ? [whole] : [])];
}

/** What is wrong with a field, in plain words, or null when nothing is. */
export function problemWith(field: NumberField, control: AbstractControl): string | null {
  if (control.valid) return null;
  const rule: FieldRule = NUMBER_FIELDS[field];
  if (control.hasError('required') || control.hasError('number')) return `${rule.label}: enter a number.`;
  if (field === 'currentBalance' && control.hasError('min')) return 'Balance you owe: enter more than $0.';
  if (control.hasError('whole')) return `${rule.label}: whole months only.`;
  return `${rule.label} must be between ${range(rule)}.`;
}
