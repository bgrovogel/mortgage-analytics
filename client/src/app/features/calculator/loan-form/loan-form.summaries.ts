import { pct, signedPct, usd } from '../../../core/formatting/format';
import { LoanForm } from './loan-form.model';

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
      ? [v.propertyTaxRate ? `Tax ${percent(v.propertyTaxRate)}` : '']
      : [
          v.schoolTaxRate ? `School ${percent(v.schoolTaxRate)}` : '',
          v.localTaxRate ? `County/city ${percent(v.localTaxRate)}` : '',
          v.mudTaxRate ? `MUD ${percent(v.mudTaxRate)}` : '',
        ]),
    v.pidAnnual ? `PID ${usd(v.pidAnnual)}/yr` : '',
  ]);
  if (!taxes) return 'No property taxes';

  return joined([
    taxes,
    relief.homestead ? (single && v.propertyTaxHomesteadExemption ? `Homestead ${usd(v.propertyTaxHomesteadExemption)} off` : 'Homestead') : '',
    relief.over65 ? 'Over 65' : '',
    relief.rateChanges ? `${relief.rateChanges} rate change${relief.rateChanges === 1 ? '' : 's'}` : '',
  ]);
}

/** The insurance, HOA and PMI section. PMI is named only when the down payment requires it. */
export function costsSummary(v: LoanFormValues, { pmiApplies }: { pmiApplies: boolean }): string {
  return joined([
    v.annualInsurance ? `Insurance ${usd(v.annualInsurance)}/yr` : '',
    v.monthlyHoa ? `HOA ${usd(v.monthlyHoa)}/mo` : '',
    pmiApplies && v.pmiRate ? `PMI ${percent(v.pmiRate)}` : '',
  ]) || 'None';
}

/** The closing-costs section: the fees together, the prepaid interest and escrow, and any credits. */
export function closingSummary(v: LoanFormValues): string {
  const fees = (v.loanCosts ?? 0) + (v.otherFees ?? 0);
  return joined([
    fees ? `Fees ${usd(fees)}` : '',
    v.prepaidInterestDays ? `${v.prepaidInterestDays} days interest` : '',
    v.escrowMonths ? `${v.escrowMonths} mo escrow` : '',
    v.closingCredits ? `Seller credits ${usd(v.closingCredits)}` : '',
    v.lenderCredits ? `Lender credits ${usd(v.lenderCredits)}` : '',
  ]) || 'No fees';
}

/** The household's income a year, debts a month and monthly budget, or that none is given. */
export function incomeSummary(v: LoanFormValues): string {
  const parts = [
    ...(v.annualIncome ? [`Income ${usd(v.annualIncome)}/yr`, `Debts ${usd(v.monthlyDebts ?? 0)}/mo`] : []),
    ...(v.monthlyBudget ? [`Budget ${usd(v.monthlyBudget)}/mo`] : []),
  ];
  return parts.length > 0 ? joined(parts) : 'Add yours to see what you can afford';
}

/** The yearly-increase assumptions, each signed; a blank counts as no change. */
export function growthSummary(v: LoanFormValues): string {
  return joined([
    `Home ${signedPercent(v.homeValueGrowthRate ?? 0)}`,
    `Insurance ${signedPercent(v.insuranceIncreaseRate ?? 0)}`,
    `HOA ${signedPercent(v.hoaIncreaseRate ?? 0)}`,
  ]);
}

/** The extra payments beyond monthly, and what they are applied to. */
export function optionsSummary(v: LoanFormValues): string {
  const lumpSums = v.lumpSums?.length ?? 0;
  return joined([
    v.annualExtra ? `${usd(v.annualExtra)} yearly` : '',
    lumpSums ? `${lumpSums} lump sum${lumpSums === 1 ? '' : 's'}` : '',
    v.strategy === 'Recast' ? `Recast (min ${usd(v.recastMinimum ?? 0)})` : 'Pay off sooner',
  ]);
}
