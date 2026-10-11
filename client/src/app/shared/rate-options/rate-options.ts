import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../core/forms/field-rules';
import { pct } from '../../core/formatting/format';
import { AdjustableRateInput, TemporaryBuydownInput } from '../../core/models/amortization.models';
import { SharedRate } from '../../core/state/shared-loan.store';

/** How a loan's rate works: fixed for the whole loan, bought down for the first years, or adjustable. */
export type RateType = 'fixed' | 'buydown' | 'arm';

/**
 * How an adjustable rate's fixed period is given: by its type (a new loan: "7/1" is 84 payments, then yearly), or
 * by the payments until its next reset (a loan already being paid).
 */
export type ArmMode = 'type' | 'reset';

/** The usual temporary buydowns: points off the note rate in each year, year 1 first. */
export const BUYDOWNS = [
  { value: '1-0', label: '1-0 (1 point off in year 1)', reductions: [1] },
  { value: '2-1', label: '2-1 (2 points off, then 1)', reductions: [2, 1] },
  { value: '3-2-1', label: '3-2-1 (3, 2, then 1 off)', reductions: [3, 2, 1] },
  { value: '1-1', label: '1-1 (1 point off for 2 years)', reductions: [1, 1] },
] as const;

export type BuydownPlan = (typeof BUYDOWNS)[number]['value'];

/** The usual adjustable rates: how long the starting rate lasts, and how often it resets after that. */
export const ARM_TYPES = [
  { value: '5/1', fixedMonths: 60, intervalMonths: 12 },
  { value: '7/1', fixedMonths: 84, intervalMonths: 12 },
  { value: '10/1', fixedMonths: 120, intervalMonths: 12 },
  { value: '5/6', fixedMonths: 60, intervalMonths: 6 },
  { value: '7/6', fixedMonths: 84, intervalMonths: 6 },
  { value: '10/6', fixedMonths: 120, intervalMonths: 6 },
  // Any other fixed period and reset interval, entered as numbers.
  { value: 'other', fixedMonths: 0, intervalMonths: 0 },
] as const;

export type ArmType = (typeof ARM_TYPES)[number]['value'];

/** The adjustable rate's numbers, with the limits the API enforces (AdjustableRateRequestValidator). */
export const RATE_OPTION_RULES = {
  armFixedMonths: { label: 'Payments until the next reset', unit: 'number', min: 1, max: 599, whole: true },
  armExpectedRate: { label: 'Rate after the fixed period', unit: '%', min: 0, max: 30, decimals: 4 },
  armInitialCap: { label: 'First reset cap', unit: '%', min: 0, max: 10 },
  armPeriodicCap: { label: 'Later reset cap', unit: '%', min: 0, max: 10 },
  armLifetimeCap: { label: 'Lifetime cap', unit: '%', min: 0, max: 10 },
} as const satisfies FieldRules;

const ARM_NUMBERS = ['armFixedMonths', 'armExpectedRate', 'armInitialCap', 'armPeriodicCap', 'armLifetimeCap'] as const;

/** The rate options' controls. */
export type RateOptionsForm = FormGroup<{
  rateType: FormControl<RateType>;
  buydownPlan: FormControl<BuydownPlan>;
  armType: FormControl<ArmType>;
  armFixedMonths: FormControl<number>;
  armIntervalMonths: FormControl<number>;
  armExpectedRate: FormControl<number>;
  armInitialCap: FormControl<number>;
  armPeriodicCap: FormControl<number>;
  armLifetimeCap: FormControl<number>;
}>;

/**
 * The rate options' controls: a fixed rate to start, and, ready for when they are chosen, a 2-1 buydown and a
 * 7/1 ARM with the usual 5/2/5 caps (expected to reset to <paramref name="expectedRate"/>). The adjustable rate's
 * numbers are disabled, and so not checked, unless the rate is adjustable (see keepArmFieldsInStep).
 */
export function rateOptionsForm(fb: NonNullableFormBuilder, expectedRate = 7.5, fixedMonths = 60): RateOptionsForm {
  const disabled = <T>(value: T) => ({ value, disabled: true });
  return fb.group({
    rateType: fb.control<RateType>('fixed'),
    buydownPlan: fb.control<BuydownPlan>('2-1'),
    armType: fb.control<ArmType>('7/1'),
    armFixedMonths: fb.control(disabled(fixedMonths), validatorsFor(RATE_OPTION_RULES.armFixedMonths)),
    armIntervalMonths: fb.control(12),
    armExpectedRate: fb.control(disabled(expectedRate), validatorsFor(RATE_OPTION_RULES.armExpectedRate)),
    armInitialCap: fb.control(disabled(5), validatorsFor(RATE_OPTION_RULES.armInitialCap)),
    armPeriodicCap: fb.control(disabled(2), validatorsFor(RATE_OPTION_RULES.armPeriodicCap)),
    armLifetimeCap: fb.control(disabled(5), validatorsFor(RATE_OPTION_RULES.armLifetimeCap)),
  });
}

/** Enables the adjustable rate's numbers only while the rate is adjustable, now and whenever the choice changes. */
export function keepArmFieldsInStep(form: RateOptionsForm, destroyRef?: DestroyRef): void {
  syncArmFields(form);
  form.controls.rateType.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => syncArmFields(form));
}

/** Enables the adjustable rate's numbers if the rate is adjustable, and disables them otherwise, quietly. */
function syncArmFields(form: RateOptionsForm): void {
  for (const name of ARM_NUMBERS) {
    if (form.controls.rateType.value === 'arm') form.controls[name].enable({ emitEvent: false });
    else form.controls[name].disable({ emitEvent: false });
  }
}

/** The months fixed and the reset interval, from the ARM's type or its payments until the next reset. */
function armTiming(v: ReturnType<RateOptionsForm['getRawValue']>, mode: ArmMode) {
  if (mode === 'reset' || v.armType === 'other') return { fixedMonths: v.armFixedMonths, intervalMonths: v.armIntervalMonths };
  const type = ARM_TYPES.find((t) => t.value === v.armType)!;
  return { fixedMonths: type.fixedMonths, intervalMonths: type.intervalMonths };
}

/** What the options mean for a request: a buydown, an adjustable rate, or neither. */
export function rateOptionsRequest(form: RateOptionsForm, mode: ArmMode): { buydown: TemporaryBuydownInput | null; adjustableRate: AdjustableRateInput | null } {
  const v = form.getRawValue();
  const timing = armTiming(v, mode);
  return {
    buydown: v.rateType === 'buydown' ? { yearlyReductions: [...BUYDOWNS.find((b) => b.value === v.buydownPlan)!.reductions] } : null,
    adjustableRate: v.rateType === 'arm'
      ? {
          initialFixedMonths: timing.fixedMonths,
          adjustmentIntervalMonths: timing.intervalMonths,
          expectedRate: v.armExpectedRate,
          initialCap: v.armInitialCap,
          periodicCap: v.armPeriodicCap,
          lifetimeCap: v.armLifetimeCap,
        }
      : null,
  };
}

/**
 * Sets the options from a request's buydown or adjustable rate (the closest usual buydown or ARM type), or a fixed
 * rate, quietly: the form it belongs to sends nothing for it. Values that do not apply keep what they were.
 */
export function setRateOptions(form: RateOptionsForm, buydown: TemporaryBuydownInput | null | undefined, arm: AdjustableRateInput | null | undefined): void {
  if (buydown) {
    const plan = BUYDOWNS.find((b) => b.reductions.join() === buydown.yearlyReductions.join()) ?? BUYDOWNS[1];
    form.patchValue({ rateType: 'buydown', buydownPlan: plan.value }, { emitEvent: false });
  } else if (arm) {
    const type = ARM_TYPES.find((t) => t.fixedMonths === arm.initialFixedMonths && t.intervalMonths === arm.adjustmentIntervalMonths);
    form.patchValue({
      rateType: 'arm', armType: type?.value ?? 'other',
      armFixedMonths: arm.initialFixedMonths, armIntervalMonths: arm.adjustmentIntervalMonths, armExpectedRate: arm.expectedRate,
      armInitialCap: arm.initialCap, armPeriodicCap: arm.periodicCap, armLifetimeCap: arm.lifetimeCap,
    }, { emitEvent: false });
  } else {
    form.patchValue({ rateType: 'fixed' }, { emitEvent: false });
  }
  syncArmFields(form);
}

/**
 * Takes the shared loan's rate type (see SharedRate), quietly, and says whether that changed anything.
 * <paramref name="made"/> is the payments already made where an ARM's fixed period counts from the first payment
 * (the shared one counts from today). A page without a buydown option shows a shared buydown as fixed.
 */
export function applySharedRate(form: RateOptionsForm, rate: SharedRate | null | undefined, made = 0, allowBuydown = true): boolean {
  if (!rate) return false;
  const before = JSON.stringify(form.getRawValue());
  if (rate.kind === 'buydown' && allowBuydown) {
    setRateOptions(form, { yearlyReductions: rate.yearlyReductions }, null);
  } else if (rate.kind === 'arm') {
    setRateOptions(form, null, {
      initialFixedMonths: made + rate.nextResetIn, adjustmentIntervalMonths: rate.intervalMonths, expectedRate: rate.expectedRate,
      initialCap: rate.initialCap, periodicCap: rate.periodicCap, lifetimeCap: rate.lifetimeCap,
    });
  } else {
    setRateOptions(form, null, null);
  }
  return JSON.stringify(form.getRawValue()) !== before;
}

/** "4.5% in year 1, 5.5% in year 2, then 6.5%": the rate each year of a buydown is paid at. */
export function buydownSteps(plan: BuydownPlan, rate: number): string {
  const years = BUYDOWNS.find((b) => b.value === plan)!.reductions.map((r, i) => `${pct(Math.max(0, rate - r))} in year ${i + 1}`);
  return `${years.join(', ')}, then ${pct(rate)}`;
}

/** One line for a closed section: "Fixed for the whole loan", "2-1 buydown: …", or "7/1 ARM: 6.5% for 7 yr, then toward 7.5% (caps 5/2/5)". */
export function rateSummary(form: RateOptionsForm, mode: ArmMode, rate: number): string {
  const v = form.getRawValue();
  if (v.rateType === 'buydown') return `${v.buydownPlan} buydown: ${buydownSteps(v.buydownPlan, rate)}`;
  if (v.rateType === 'arm') {
    const caps = `(caps ${v.armInitialCap}/${v.armPeriodicCap}/${v.armLifetimeCap})`;
    if (mode === 'reset') return `Adjustable: ${pct(rate)} for ${v.armFixedMonths} more payments, then toward ${pct(v.armExpectedRate)} ${caps}`;
    if (v.armType === 'other') return `ARM: ${pct(rate)} for ${v.armFixedMonths} payments, then toward ${pct(v.armExpectedRate)} ${caps}`;
    const type = ARM_TYPES.find((t) => t.value === v.armType)!;
    return `${v.armType} ARM: ${pct(rate)} for ${type.fixedMonths / 12} yr, then toward ${pct(v.armExpectedRate)} ${caps}`;
  }
  return 'Fixed for the whole loan';
}
