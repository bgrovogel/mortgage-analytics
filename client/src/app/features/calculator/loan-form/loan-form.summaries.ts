import { pct, signedPct, usd } from '../../../core/formatting/format';
import { LoanForm } from './loan-form.model';
import { t, tp } from '../../../core/i18n/i18n';

/**
 * The one-line summaries a collapsed form section shows, as pure functions of the form's values. The component
 * decides when a section is invalid (and says so instead); these only put valid values into words.
 */

/** The form's values as they change: every field may be missing while the user types. */
type LoanFormValues = LoanForm['value'];

/** 1 becomes "1%", 0.85 becomes "0.85%": rates here have up to four decimals. */
const percent = (value: number) => pct(value, 4);

/** 4 becomes "+4%", -2 becomes "-2%", 0 becomes "0%". */
const signedPercent = (value: number) => signedPct(value, 4);

/** Joins the parts that are present with a middle dot. */
const joined = (parts: string[]) => parts.filter(Boolean).join(' · ');

/** The property-tax section: each rate (or the one combined rate), PID, and the homestead and over-65 relief. */
export function taxesSummary(v: LoanFormValues, relief: { homestead: boolean; over65: boolean; rateChanges?: number }): string {
  const single = v.taxMode === 'single';
  const taxes = joined([
    ...(single
      ? [v.propertyTaxRate ? t('Tax {0}', [percent(v.propertyTaxRate)]) : '']
      : [
          v.schoolTaxRate ? t('School {0}', [percent(v.schoolTaxRate)]) : '',
          v.localTaxRate ? t('County/city {0}', [percent(v.localTaxRate)]) : '',
          v.mudTaxRate ? t('MUD {0}', [percent(v.mudTaxRate)]) : '',
        ]),
    v.pidAnnual ? t('PID {0}/yr', [usd(v.pidAnnual)]) : '',
  ]);
  if (!taxes) return t('No property taxes');

  return joined([
    taxes,
    relief.homestead ? (single && v.propertyTaxHomesteadExemption ? t('Homestead {0} off', [usd(v.propertyTaxHomesteadExemption)]) : t('Homestead')) : '',
    relief.over65 ? t('Over 65') : '',
    relief.rateChanges ? tp(relief.rateChanges, '{n} rate change', '{n} rate changes') : '',
  ]);
}

/** The insurance, HOA and PMI section. PMI is named only when the down payment requires it. */
export function costsSummary(v: LoanFormValues, { pmiApplies }: { pmiApplies: boolean }): string {
  return joined([
    v.annualInsurance ? t('Insurance {0}/yr', [usd(v.annualInsurance)]) : '',
    v.monthlyHoa ? t('HOA {0}/mo', [usd(v.monthlyHoa)]) : '',
    pmiApplies && v.pmiRate ? t('PMI {0}', [percent(v.pmiRate)]) : '',
  ]) || t('None');
}

/** The closing-costs section: the fees together, the prepaid interest and escrow, and any credits. */
export function closingSummary(v: LoanFormValues): string {
  const fees = (v.loanCosts ?? 0) + (v.otherFees ?? 0);
  return joined([
    fees ? t('Fees {0}', [usd(fees)]) : '',
    v.prepaidInterestDays ? t('{0} days interest', [v.prepaidInterestDays]) : '',
    v.escrowMonths ? t('{0} mo escrow', [v.escrowMonths]) : '',
    v.closingCredits ? t('Seller credits {0}', [usd(v.closingCredits)]) : '',
    v.lenderCredits ? t('Lender credits {0}', [usd(v.lenderCredits)]) : '',
  ]) || t('No fees');
}

/** The buyers' income a year and debts a month added together, with how many there are, and the monthly budget, or that none is given. */
export function incomeSummary(v: LoanFormValues): string {
  // A co-buyer counts once they have an income.
  const coBuyers = (v.coBuyers ?? []).filter((c) => c.annualIncome);
  const income = (v.annualIncome ?? 0) + coBuyers.reduce((sum, c) => sum + (c.annualIncome ?? 0), 0);
  const debts = (v.monthlyDebts ?? 0) + coBuyers.reduce((sum, c) => sum + (c.monthlyDebts ?? 0), 0);
  const parts = [
    ...(v.annualIncome ? [...(coBuyers.length > 0 ? [t('{0} buyers', [coBuyers.length + 1])] : []), t('Income {0}/yr', [usd(income)]), t('Debts {0}/mo', [usd(debts)])] : []),
    ...(v.monthlyBudget ? [t('Budget {0}/mo', [usd(v.monthlyBudget)])] : []),
  ];
  return parts.length > 0 ? joined(parts) : t('Add yours to see what you can afford');
}

/** The yearly-increase assumptions, each signed; a blank counts as no change. */
export function growthSummary(v: LoanFormValues): string {
  return joined([
    t('Home {0}', [signedPercent(v.homeValueGrowthRate ?? 0)]),
    t('Insurance {0}', [signedPercent(v.insuranceIncreaseRate ?? 0)]),
    t('HOA {0}', [signedPercent(v.hoaIncreaseRate ?? 0)]),
  ]);
}

/** The extra payments beyond monthly, and what they are applied to. */
export function optionsSummary(v: LoanFormValues): string {
  const lumpSums = v.lumpSums?.length ?? 0;
  return joined([
    v.annualExtra ? t('{0} yearly', [usd(v.annualExtra)]) : '',
    lumpSums ? tp(lumpSums, '{n} lump sum', '{n} lump sums') : '',
    v.strategy === 'Recast' ? t('Recast (min {0})', [usd(v.recastMinimum ?? 0)]) : t('Pay off sooner'),
  ]);
}
