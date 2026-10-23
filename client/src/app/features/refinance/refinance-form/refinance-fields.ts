import { FieldRules, MAX_AMOUNT } from '../../../core/forms/field-rules';
import { msg, t } from '../../../core/i18n/i18n';

/** The problems with a debt to pay off: the cash out must cover it, and its payment must shrink it. */
export const DEBT_TOO_BIG = msg("Take out at least the debt's balance for the cash to pay it off.");
export const DEBT_PAYMENT_TOO_LOW = msg("The payment must be more than a month's interest, or the debt never shrinks.");

/** The problem with discount points' rates, if any: the rate without them must be the higher one. */
export const POINTS_RATE_TOO_LOW = msg('The rate without points must be higher than the rate with them.');

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
  yearsKept: { get label() { return t('Years kept'); }, unit: 'years', min: 1, max: 30, whole: true },
  debtBalance: { get label() { return t('Debt balance'); }, unit: '$', min: 0.01, max: MAX_AMOUNT },
  debtRate: { get label() { return t('Debt rate'); }, unit: '%', min: 0, max: 40, decimals: 2 },
  debtIncome: { get label() { return t('Household income a year'); }, unit: '$', min: 0.01, max: 100_000_000, optional: true },
  debtOtherDebts: { get label() { return t('Other debts a month'); }, unit: '$', min: 0, max: 8_333_333, optional: true },
  debtPayment: { get label() { return t('Debt payment'); }, unit: '$', min: 0.01, max: MAX_AMOUNT },
  points: { get label() { return t('Points'); }, unit: 'number', min: 0.001, max: 5, decimals: 3 },
  rateWithoutPoints: { get label() { return t('Rate without points'); }, unit: '%', min: 0, max: 30, decimals: 4 },
  equityDrawYears: { get label() { return t('Draw period'); }, unit: 'years', min: 1 / 12, max: 30 },
  equityRepaymentRate: { get label() { return t('Rate once repaying'); }, unit: '%', min: 0, max: 30, decimals: 4 },
} as const satisfies FieldRules;
