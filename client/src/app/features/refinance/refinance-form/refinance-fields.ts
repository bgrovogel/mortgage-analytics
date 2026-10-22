import { FieldRules, MAX_AMOUNT } from '../../../core/forms/field-rules';
import { t } from '../../../core/i18n/i18n';

/** Every number on the refinance form, with the limits the API enforces (RefinanceRequestValidator). */
export const REFINANCE_RULES = {
  currentBalance: { get label() { return t('Balance you still owe'); }, unit: '$', min: 0.01, max: MAX_AMOUNT },
  currentAnnualInterestRate: { get label() { return t('Current rate'); }, unit: '%', min: 0, max: 30, decimals: 4 },
  yearsLeft: { get label() { return t('Years left'); }, unit: 'years', min: 1 / 12, max: 50 },
  originalAmount: { get label() { return t('Amount borrowed'); }, unit: '$', min: 0.01, max: MAX_AMOUNT },
  originalTermYears: { get label() { return t('Original term'); }, unit: 'years', min: 1, max: 50, whole: true },
  newAnnualInterestRate: { get label() { return t('New rate'); }, unit: '%', min: 0, max: 30, decimals: 4 },
  closingCosts: { get label() { return t('Closing costs'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  cashOut: { get label() { return t('Cash out'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  homeValue: { get label() { return t('Home value'); }, unit: '$', min: 0.01, max: MAX_AMOUNT },
  currentMonthlyPmi: { get label() { return t('PMI per month'); }, unit: '$', min: 0, max: 10_000 },
  newPmiRate: { get label() { return t('PMI on the new loan'); }, unit: '%', min: 0, max: 5 },
  equityRate: { get label() { return t('Home-equity loan rate'); }, unit: '%', min: 0, max: 30, decimals: 4 },
  equityTermYears: { get label() { return t('Home-equity loan term'); }, unit: 'years', min: 1 / 12, max: 30 },
  equityYearsKept: { get label() { return t('Years kept'); }, unit: 'years', min: 1, max: 30, whole: true },
} as const satisfies FieldRules;
