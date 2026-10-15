import { FieldRules, MAX_AMOUNT } from '../../../core/forms/field-rules';

/** Every number on the refinance form, with the limits the API enforces (RefinanceRequestValidator). */
export const REFINANCE_RULES = {
  currentBalance: { label: 'Balance you still owe', unit: '$', min: 0.01, max: MAX_AMOUNT },
  currentAnnualInterestRate: { label: 'Current rate', unit: '%', min: 0, max: 30, decimals: 4 },
  yearsLeft: { label: 'Years left', unit: 'years', min: 1 / 12, max: 50 },
  originalAmount: { label: 'Amount borrowed', unit: '$', min: 0.01, max: MAX_AMOUNT },
  originalTermYears: { label: 'Original term', unit: 'years', min: 1, max: 50, whole: true },
  newAnnualInterestRate: { label: 'New rate', unit: '%', min: 0, max: 30, decimals: 4 },
  closingCosts: { label: 'Closing costs', unit: '$', min: 0, max: MAX_AMOUNT },
  cashOut: { label: 'Cash out', unit: '$', min: 0, max: MAX_AMOUNT },
  homeValue: { label: 'Home value', unit: '$', min: 0.01, max: MAX_AMOUNT },
  currentMonthlyPmi: { label: 'PMI per month', unit: '$', min: 0, max: 10_000 },
  newPmiRate: { label: 'PMI on the new loan', unit: '%', min: 0, max: 5 },
} as const satisfies FieldRules;
