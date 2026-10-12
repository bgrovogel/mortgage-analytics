import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { validatorsFor } from '../../../core/forms/field-rules';
import { firstOfMonthFromNext, toCents } from '../../../core/loans/loan-progress';
import { AmortizationRequest, BuydownFunding, ExtraPaymentStrategy, MortgageInsuranceCancellation } from '../../../core/models/amortization.models';
import { rateOptionsForm, rateOptionsRequest, setRateOptions } from '../../../shared/rate-options/rate-options';
import { LOAN_RULES as rules, LUMP_SUM_RULES } from './loan-fields';

/**
 * The calculator's form as data: its controls and defaults, and the conversions between its values and the API's
 * request. The component adds what the page shows (summaries, hints, problems); this file holds no view logic.
 */

/** Whether the down payment field holds dollars or a percentage of the price. */
export type DownPaymentMode = 'amount' | 'percent';

/** How property taxes are entered: one combined rate (most places), or separate school, county/city and MUD rates (Texas). */
export type TaxMode = 'single' | 'separate';

export type LumpSumForm = FormGroup<{ paymentNumber: FormControl<number>; amount: FormControl<number> }>;

/** The controls each way of entering taxes uses; the other way's are disabled, so they are neither checked nor sent. */
const TAX_MODE_CONTROLS = {
  single: ['propertyTaxRate', 'propertyTaxHomesteadExemption'],
  separate: ['schoolTaxRate', 'localTaxRate', 'mudTaxRate', 'schoolHomesteadExemption', 'localHomesteadExemptionPercent',
    'mudHomesteadExemptionPercent', 'over65Year', 'over65SchoolExemption', 'over65LocalExemption'],
} as const;

/**
 * The form, with defaults that describe a typical Texas homestead purchase with 5% down, so PMI, the homestead
 * exemption and yearly increases are all visible on load.
 */
export function loanForm(fb: NonNullableFormBuilder) {
  return fb.group({
    homePrice: [375_000, validatorsFor(rules.homePrice)],
    downPaymentMode: fb.control<DownPaymentMode>('amount'),
    // Dollars or a percentage of the price, depending on downPaymentMode.
    downPayment: [18_750, validatorsFor(rules.downPayment)],
    annualInterestRate: [6.5, validatorsFor(rules.annualInterestRate)],
    termYears: [30, validatorsFor(rules.termYears)],
    // Optional: a blank date lets the API default to the first of next month.
    firstPaymentDate: [firstOfMonthFromNext(0)],

    // One combined rate and one homestead exemption, the way most places quote them; or the separate Texas taxes.
    taxMode: fb.control<TaxMode>('single'),
    propertyTaxRate: [2.2, validatorsFor(rules.propertyTaxRate)],
    propertyTaxHomesteadExemption: [50_000, validatorsFor(rules.propertyTaxHomesteadExemption)],
    schoolTaxRate: [1.0, validatorsFor(rules.schoolTaxRate)],
    localTaxRate: [1.1, validatorsFor(rules.localTaxRate)],
    mudTaxRate: [0.85, validatorsFor(rules.mudTaxRate)],
    isHomestead: [true],
    schoolHomesteadExemption: [140_000, validatorsFor(rules.schoolHomesteadExemption)],
    localHomesteadExemptionPercent: [0, validatorsFor(rules.localHomesteadExemptionPercent)],
    mudHomesteadExemptionPercent: [0, validatorsFor(rules.mudHomesteadExemptionPercent)],
    homesteadAssessmentCap: [10, validatorsFor(rules.homesteadAssessmentCap)],
    isOver65: [false],
    over65Year: [1, validatorsFor(rules.over65Year)],
    over65SchoolExemption: [60_000, validatorsFor(rules.over65SchoolExemption)],
    over65LocalExemption: [0, validatorsFor(rules.over65LocalExemption)],
    over65LocalCeiling: [false],
    // Long-run US averages (sources are shown under the fields):
    // home values +4.3% a year (FHFA House Price Index, 1975-2025); home insurance +4.8% a year
    // (GAO-26-107867: average premium $2,235 in 2019 to $2,829 in 2024); HOA dues +4% (typically 3-5%).
    homeValueGrowthRate: [4.3, validatorsFor(rules.homeValueGrowthRate)],
    insuranceIncreaseRate: [4.8, validatorsFor(rules.insuranceIncreaseRate)],
    hoaIncreaseRate: [4, validatorsFor(rules.hoaIncreaseRate)],
    pidAnnual: [0, validatorsFor(rules.pidAnnual)],
    pidYears: [null as number | null, validatorsFor(rules.pidYears)],
    annualInsurance: [2_400, validatorsFor(rules.annualInsurance)],
    monthlyHoa: [50, validatorsFor(rules.monthlyHoa)],
    pmiRate: [0.5, validatorsFor(rules.pmiRate)],
    pmiCancellation: fb.control<MortgageInsuranceCancellation>('Automatic'),

    // Closing costs, as an example to replace with the Loan Estimate's own: fees as totals, then half a month of
    // interest and three months of escrow, which the API prices from the loan.
    loanCosts: [4_000, validatorsFor(rules.loanCosts)],
    otherFees: [1_000, validatorsFor(rules.otherFees)],
    prepaidInterestDays: [15, validatorsFor(rules.prepaidInterestDays)],
    escrowMonths: [3, validatorsFor(rules.escrowMonths)],
    closingCredits: [0, validatorsFor(rules.closingCredits)],

    monthlyExtra: [200, validatorsFor(rules.monthlyExtra)],
    annualExtra: [0, validatorsFor(rules.annualExtra)],
    annualFirstPayment: [12, validatorsFor(rules.annualFirstPayment)],
    lumpSums: fb.array<LumpSumForm>([]),

    strategy: fb.control<ExtraPaymentStrategy>('ShortenTerm'),

    // Fixed, a buydown, or a 7/1 ARM with the usual 5/2/5 caps, expected to reset a point higher.
    rate: rateOptionsForm(fb, 7.5),
    // Who pays for a buydown: the seller or builder (a concession), unless the buyer says they do, at closing.
    buydownPaidBy: fb.control<BuydownFunding>('Seller'),
    // Discount points: off unless chosen; one point, against a quarter point more without it.
    usePoints: [false],
    points: [1, validatorsFor(rules.points)],
    rateWithoutPoints: [6.75, validatorsFor(rules.rateWithoutPoints)],
    recastMinimum: [10_000, validatorsFor(rules.recastMinimum)],
    recastFee: [250, validatorsFor(rules.recastFee)],
  });
}

export type LoanForm = ReturnType<typeof loanForm>;

/** One lump-sum row. */
export function lumpSumGroup(fb: NonNullableFormBuilder, paymentNumber: number, amount: number): LumpSumForm {
  return fb.group({
    paymentNumber: [paymentNumber, validatorsFor(LUMP_SUM_RULES.paymentNumber)],
    amount: [amount, validatorsFor(LUMP_SUM_RULES.amount)],
  });
}

/** The down payment in dollars: as entered, or the entered percentage of the price, rounded to cents. */
export function downPaymentAmountOf(v: { homePrice?: number; downPayment?: number; downPaymentMode?: DownPaymentMode }): number {
  const entered = v.downPayment ?? 0;
  return v.downPaymentMode === 'percent' ? toCents(((v.homePrice ?? 0) * entered) / 100) : entered;
}

/** True when discount points are chosen, on a rate they can be compared on (not an adjustable one). */
export function pointsApply(v: { usePoints?: boolean; rate?: { rateType?: string } }): boolean {
  return !!v.usePoints && v.rate?.rateType !== 'arm';
}

/** The problem with discount points' rates, if any: the rate without them must be the higher one. */
export const POINTS_RATE_TOO_LOW = 'The rate without points must be higher than the rate with them.';

/**
 * Checks the points' fields only while points apply, and starts the rate without them a quarter point above the
 * loan's rate when it is not already higher.
 */
export function syncPoints(form: LoanForm): void {
  const v = form.getRawValue();
  const apply = pointsApply(v);
  for (const name of ['points', 'rateWithoutPoints'] as const) {
    if (apply) form.controls[name].enable({ emitEvent: false });
    else form.controls[name].disable({ emitEvent: false });
  }
  if (apply && v.rateWithoutPoints <= v.annualInterestRate && !form.controls.rateWithoutPoints.dirty) {
    form.controls.rateWithoutPoints.setValue(Math.round((v.annualInterestRate + 0.25) * 10_000) / 10_000, { emitEvent: false });
  }
}

/** Enables the controls of the chosen way of entering taxes, and disables the other's. */
export function syncTaxMode(form: LoanForm): void {
  const mode = form.controls.taxMode.value;
  for (const name of TAX_MODE_CONTROLS[mode]) form.controls[name].enable({ emitEvent: false });
  for (const name of TAX_MODE_CONTROLS[mode === 'single' ? 'separate' : 'single']) form.controls[name].disable({ emitEvent: false });
}

/**
 * The API request for the form's values (years become months, flat fields become the request's groups). On a loan
 * already being paid, extra payments can only start with `nextPayment`.
 */
export function toLoanRequest(form: LoanForm, nextPayment: number): AmortizationRequest {
  const v = form.getRawValue();
  const single = v.taxMode === 'single';
  const annualFirst = v.annualFirstPayment < nextPayment
    ? v.annualFirstPayment + Math.ceil((nextPayment - v.annualFirstPayment) / 12) * 12
    : v.annualFirstPayment;
  return {
    homePrice: v.homePrice,
    downPayment: downPaymentAmountOf(v),
    annualInterestRate: v.annualInterestRate,
    termInMonths: v.termYears * 12,
    firstPaymentDate: v.firstPaymentDate || null,
    strategy: v.strategy,
    recast: v.strategy === 'Recast' ? { minimumLumpSum: v.recastMinimum, fee: v.recastFee } : null,
    extraPayments: {
      monthlyAmount: v.monthlyExtra || 0,
      monthlyStartingPaymentNumber: nextPayment,
      annual: v.annualExtra > 0 ? { amount: v.annualExtra, firstPaymentNumber: annualFirst } : null,
      lumpSums: v.lumpSums,
    },
    housingCosts: {
      propertyTaxRate: single ? v.propertyTaxRate || 0 : 0,
      propertyTaxHomesteadExemption: single ? v.propertyTaxHomesteadExemption || 0 : 0,
      schoolTaxRate: single ? 0 : v.schoolTaxRate || 0,
      localTaxRate: single ? 0 : v.localTaxRate || 0,
      mudTaxRate: single ? 0 : v.mudTaxRate || 0,
      isHomestead: v.isHomestead,
      schoolHomesteadExemption: v.schoolHomesteadExemption || 0,
      localHomesteadExemptionPercent: v.localHomesteadExemptionPercent || 0,
      mudHomesteadExemptionPercent: v.mudHomesteadExemptionPercent || 0,
      homesteadAssessmentCap: v.homesteadAssessmentCap || 0,
      over65OrDisabled: !single && v.isHomestead && v.isOver65
        ? {
            qualifiesInYear: v.over65Year || 1,
            schoolExemption: v.over65SchoolExemption || 0,
            localExemption: v.over65LocalExemption || 0,
            localTaxCeiling: v.over65LocalCeiling,
          }
        : null,
      homeValueGrowthRate: v.homeValueGrowthRate || 0,
      insuranceIncreaseRate: v.insuranceIncreaseRate || 0,
      hoaIncreaseRate: v.hoaIncreaseRate || 0,
      pid: v.pidAnnual > 0 ? { annualAssessment: v.pidAnnual, remainingYears: v.pidYears || null } : null,
      annualHomeownersInsurance: v.annualInsurance || 0,
      monthlyHoaDues: v.monthlyHoa || 0,
      pmiRate: v.pmiRate || 0,
      pmiCancellation: v.pmiCancellation,
    },
    ...rateOptionsRequest(form.controls.rate, 'type'),
    buydownPaidBy: v.buydownPaidBy,
    discountPoints: pointsApply(v) ? { points: v.points, rateWithoutPoints: v.rateWithoutPoints } : null,
    closingCosts: {
      loanCosts: v.loanCosts || 0,
      otherFees: v.otherFees || 0,
      prepaidInterestDays: v.prepaidInterestDays || 0,
      escrowMonths: v.escrowMonths || 0,
      credits: v.closingCredits || 0,
    },
  };
}

/**
 * Fills the form from a request: the reverse of toLoanRequest. The value changes it emits are for what the page
 * shows; the caller keeps them from sending a request. The down payment comes back in
 * dollars. Parts the request leaves out (no extras, no housing costs, no closing costs) become zero; fields that only
 * matter when an option is on (recast terms, over-65 details) keep their defaults when it is off, and so do the days
 * of interest and months of escrow, which every closing has.
 */
export function restoreLoanForm(form: LoanForm, fb: NonNullableFormBuilder, r: AmortizationRequest): void {
  const extras = r.extraPayments;
  const costs = r.housingCosts;
  const senior = costs?.over65OrDisabled;
  const closing = r.closingCosts;
  const quietly = { emitEvent: false };
  form.controls.downPaymentMode.setValue('amount', quietly);
  form.controls.lumpSums.clear(quietly);
  for (const lump of extras?.lumpSums ?? []) {
    form.controls.lumpSums.push(lumpSumGroup(fb, lump.paymentNumber, lump.amount), quietly);
  }
  form.patchValue({
    homePrice: r.homePrice,
    downPayment: r.downPayment,
    annualInterestRate: r.annualInterestRate,
    termYears: Math.round(r.termInMonths / 12),
    firstPaymentDate: r.firstPaymentDate ?? '',
    strategy: r.strategy,
    ...(r.recast && { recastMinimum: r.recast.minimumLumpSum, recastFee: r.recast.fee }),
    monthlyExtra: extras?.monthlyAmount ?? 0,
    annualExtra: extras?.annual?.amount ?? 0,
    ...(extras?.annual && { annualFirstPayment: extras.annual.firstPaymentNumber }),
    // One rate when the request has one (or none at all); otherwise the separate rates it was saved with.
    taxMode: (costs?.propertyTaxRate ?? 0) > 0 || !costs || costs.schoolTaxRate + costs.localTaxRate + costs.mudTaxRate === 0 ? 'single' : 'separate',
    propertyTaxRate: costs?.propertyTaxRate ?? 0,
    propertyTaxHomesteadExemption: costs?.propertyTaxHomesteadExemption ?? 0,
    schoolTaxRate: costs?.schoolTaxRate ?? 0,
    localTaxRate: costs?.localTaxRate ?? 0,
    mudTaxRate: costs?.mudTaxRate ?? 0,
    isHomestead: costs?.isHomestead ?? false,
    schoolHomesteadExemption: costs?.schoolHomesteadExemption ?? 0,
    localHomesteadExemptionPercent: costs?.localHomesteadExemptionPercent ?? 0,
    mudHomesteadExemptionPercent: costs?.mudHomesteadExemptionPercent ?? 0,
    homesteadAssessmentCap: costs?.homesteadAssessmentCap ?? 0,
    isOver65: !!senior,
    ...(senior && {
      over65Year: senior.qualifiesInYear,
      over65SchoolExemption: senior.schoolExemption,
      over65LocalExemption: senior.localExemption,
      over65LocalCeiling: senior.localTaxCeiling,
    }),
    homeValueGrowthRate: costs?.homeValueGrowthRate ?? 0,
    insuranceIncreaseRate: costs?.insuranceIncreaseRate ?? 0,
    hoaIncreaseRate: costs?.hoaIncreaseRate ?? 0,
    pidAnnual: costs?.pid?.annualAssessment ?? 0,
    pidYears: costs?.pid?.remainingYears ?? null,
    annualInsurance: costs?.annualHomeownersInsurance ?? 0,
    monthlyHoa: costs?.monthlyHoaDues ?? 0,
    pmiRate: costs?.pmiRate ?? 0,
    ...(costs && { pmiCancellation: costs.pmiCancellation }),
    buydownPaidBy: r.buydownPaidBy ?? 'Seller',
    usePoints: !!r.discountPoints,
    ...(r.discountPoints && { points: r.discountPoints.points, rateWithoutPoints: r.discountPoints.rateWithoutPoints }),
    loanCosts: closing?.loanCosts ?? 0,
    otherFees: closing?.otherFees ?? 0,
    ...(closing && { prepaidInterestDays: closing.prepaidInterestDays, escrowMonths: closing.escrowMonths }),
    closingCredits: closing?.credits ?? 0,
  });
  setRateOptions(form.controls.rate, r.buydown, r.adjustableRate);
  syncTaxMode(form);
  syncPoints(form);
}
