import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, Signal, computed, inject, input, output, signal } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { merge } from 'rxjs';
import { problemsIn, problemsOf } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { exampleUntilEdited } from '../../../core/forms/example-until-edited';
import { NumberInputDirective } from '../../../core/forms/number-input.directive';
import { setChanged } from '../../../core/forms/set-changed';
import { formatMonths } from '../../../core/formatting/duration';
import { decimal } from '../../../core/formatting/format';
import { SharedLoanChange } from '../../../core/state/shared-loan.store';
import { AmortizationRequest, YearProjection } from '../../../core/models/amortization.models';
import { PAID_OFF_ALREADY, balanceAfter, originalAmount, paymentsMade, toCents } from '../../../core/loans/loan-progress';
import { LOAN_RULES, LUMP_SUM_RULES, RATE_CHANGE_RULES, wholeYearsOf } from './loan-fields';
import { RateOptionsComponent } from '../../../shared/rate-options/rate-options.component';
import { FhaCountyComponent } from './fha-county.component';
import { RATE_OPTION_RULES, applySharedRate, keepArmFieldsInStep, rateSummary } from '../../../shared/rate-options/rate-options';
import {
  LumpSumForm, RateChangeForm, chargedTaxes, fhaDownProblem, rateChangeGroup, rateChangesOf, POINTS_RATE_TOO_LOW, downPaymentAmountOf, loanForm, lumpSumGroup, pointsApply, restoreLoanForm, syncPoints, syncTaxMode, toLoanRequest,
} from './loan-form.model';
import { closingSummary, costsSummary, growthSummary, optionsSummary, taxesSummary } from './loan-form.summaries';

const rules = LOAN_RULES;

/** Shown while the down payment leaves nothing to borrow. */
export const NOTHING_TO_BORROW = 'The down payment must be less than the home price.';

/** Shown for a lump sum on a payment already made. */
const lumpSumInThePast = (paymentNumber: number, next: number) =>
  `A lump sum with payment #${paymentNumber} is in the past: payment #${next} is next.`;

/** Shown in a section's summary when one of its fields is invalid, so the problem is not hidden by collapsing. */
const CHECK_SECTION = 'Check the values in this section';

/** Controls inside each collapsible section, used to flag a closed section that holds an invalid value. */
const SECTION_CONTROLS = {
  taxes: ['propertyTaxRate', 'propertyTaxHomesteadExemption', 'schoolTaxRate', 'localTaxRate', 'mudTaxRate', 'pidAnnual', 'pidYears', 'schoolHomesteadExemption',
    'localHomesteadExemptionPercent', 'mudHomesteadExemptionPercent', 'homesteadAssessmentCap', 'over65Year', 'over65SchoolExemption', 'over65LocalExemption',
    'transferredCeilingPercent', 'rateChanges'],
  costs: ['annualInsurance', 'monthlyHoa', 'pmiRate'],
  program: ['creditScore'],
  closing: ['loanCosts', 'otherFees', 'prepaidInterestDays', 'escrowMonths', 'closingCredits'],
  growth: ['homeValueGrowthRate', 'insuranceIncreaseRate', 'hoaIncreaseRate'],
  options: ['annualExtra', 'annualFirstPayment', 'lumpSums', 'recastMinimum', 'recastFee'],
  rate: ['rate', 'points', 'rateWithoutPoints'],
} as const;

/**
 * Presentational component: owns the form and emits a ready-to-send request whenever a change
 * leaves it valid, so results update as the user types. It knows nothing about HTTP or timing;
 * the store debounces and sends the requests.
 *
 * Only the five main fields are always visible. Everything else lives in collapsible sections,
 * each summarized in one line while closed.
 */
@Component({
  selector: 'app-loan-form',
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe, NumberFieldComponent, NumberInputDirective, RateOptionsComponent, FhaCountyComponent],
  templateUrl: './loan-form.component.html',
  styleUrl: './loan-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** A request to start from (the last calculation, or a saved one) instead of the worked example. */
  readonly initial = input<AmortizationRequest | null>(null);

  /** The first year of the latest result, to say what the homestead exemptions save. */
  readonly firstYear = input<YearProjection | null>(null);

  /**
   * What the homestead exemptions save in year 1, by tax: the value each one takes off, times that tax's rate.
   * Null when the home is not a homestead or there is no result yet.
   */
  readonly homesteadSavings = computed(() => {
    const year = this.firstYear();
    const v = this.values();
    if (!year || !v.isHomestead) return null;
    const saved = (taxable: number | null, rate: number | undefined) =>
      taxable === null ? 0 : Math.max(0, year.assessedValue - taxable) * (rate ?? 0) / 100;
    const property = saved(year.propertyTaxableValue ?? null, v.propertyTaxRate);
    const school = saved(year.schoolTaxableValue, v.schoolTaxRate);
    const local = saved(year.localTaxableValue, v.localTaxRate);
    const mud = saved(year.mudTaxableValue, v.mudTaxRate);
    const total = property + school + local + mud;
    // A $0 exemption (the example's) saves nothing worth a line.
    return Math.round(total) > 0 ? { total, school, local, mud } : null;
  });

  /** A loan changed on another page since this one was last open: the form starts from it. */
  readonly loan = input<SharedLoanChange | null>(null);

  /** Where the loan was filled in from, and, when the term had to be rounded to whole years, from what to what. */
  readonly sharedFrom = signal<{ from: string; rounded: { from: string; to: string } | null } | null>(null);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly calculate = output<AmortizationRequest>();

  private readonly destroyRef = inject(DestroyRef);

  /** True while the form shows its worked example, until the visitor's first edit (see exampleUntilEdited). */
  protected example: Signal<boolean> = signal(false);

  /** True while a request is being loaded into the form, so its many changes do not each emit. */
  private restoring = false;

  protected readonly rules = rules;
  protected readonly lumpSumRules = LUMP_SUM_RULES;
  protected readonly rateChangeRules = RATE_CHANGE_RULES;
  protected readonly nothingToBorrow = NOTHING_TO_BORROW;
  protected readonly paidOffAlready = PAID_OFF_ALREADY;
  protected readonly pointsRateMessage = POINTS_RATE_TOO_LOW;

  readonly form = loanForm(this.fb);

  protected readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Emits what is wrong whenever that changes: an empty list once the form can be sent again. */
  readonly problems = outputFromObservable(problemsOf(this.form, () => this.currentProblems()));

  /** The down payment in dollars, whichever unit it was entered in. */
  readonly downPaymentAmount = computed(() => downPaymentAmountOf(this.values()));

  /** Loan amount derived live from price and down payment, shown under the down payment field. */
  readonly loanAmount = computed(() => Math.max(0, (this.values().homePrice ?? 0) - this.downPaymentAmount()));

  /** Down payment as a percentage of the price. */
  readonly downPaymentPercent = computed(() => {
    const price = this.values().homePrice ?? 0;
    return price > 0 ? (this.downPaymentAmount() / price) * 100 : 0;
  });

  /** True when the down payment is being entered as a percentage of the price. */
  readonly downPaymentInPercent = computed(() => this.values().downPaymentMode === 'percent');

  /** PMI applies only with less than 20% down. */
  readonly pmiApplies = computed(() => this.values().loanProgram === 'Conventional' && this.downPaymentPercent() < 20);

  /** The kind of loan chosen. */
  readonly loanProgram = computed(() => this.values().loanProgram ?? 'Conventional');

  /** What stops an FHA loan from being sent, by its credit score and down payment, or null. */
  readonly fhaDownProblem = computed(() =>
    this.loanProgram() === 'Fha' ? fhaDownProblem(this.downPaymentAmount(), this.values().homePrice ?? 0, this.values().creditScore) : null);

  /** One-line summary of the loan type, and for FHA or VA how its fee is paid. */
  readonly programSummary = computed(() => {
    const v = this.values();
    const paid = v.financeUpfrontFee === false ? 'paid at closing' : 'added to the loan';
    if (v.loanProgram === 'Fha') return `FHA · upfront MIP ${paid}`;
    if (v.loanProgram !== 'Va') return 'Conventional';
    if (v.vaUse === 'Exempt') return 'VA · exempt from the funding fee';
    return `VA · ${v.vaUse === 'SubsequentUse' ? 'used before' : 'first use'} · funding fee ${paid}`;
  });

  readonly isRecast = computed(() => this.values().strategy === 'Recast');

  /** Homestead exemptions and the assessment cap apply only to a primary residence. */
  readonly isHomestead = computed(() => this.values().isHomestead === true);

  /** Over-65 / disability relief applies only to a homestead, with the separate taxes it is defined for. */
  readonly isOver65 = computed(() => this.isHomestead() && this.taxMode() === 'separate' && this.values().isOver65 === true);

  /** How property taxes are entered. */
  readonly taxMode = computed(() => this.values().taxMode);

  /** One-line summary of the property-tax section. */
  readonly taxesSummary = computed(() =>
    this.sectionInvalid('taxes')
      ? CHECK_SECTION
      : taxesSummary(this.values(), { homestead: this.isHomestead(), over65: this.isOver65(), rateChanges: rateChangesOf(this.values()).length }));

  /** The taxes charged, whose rates a rate change can change. */
  readonly chargedTaxes = computed(() => chargedTaxes(this.values()));

  /** One-line summary of the insurance, HOA and PMI section. */
  readonly costsSummary = computed(() =>
    this.sectionInvalid('costs') ? CHECK_SECTION : costsSummary(this.values(), { pmiApplies: this.pmiApplies() }));

  /** One-line summary of the closing-costs section. */
  readonly closingSummary = computed(() => (this.sectionInvalid('closing') ? CHECK_SECTION : closingSummary(this.values())));

  /** One-line summary of the yearly-increase assumptions. */
  readonly growthSummary = computed(() => (this.sectionInvalid('growth') ? CHECK_SECTION : growthSummary(this.values())));

  /**
   * A loan already being paid (its first payment is in the past): the payments behind it, the next one, and about
   * what is owed now. Null for a new loan. Its schedule starts at the real first payment, so PMI follows the
   * original loan and its original schedule; extra payments start with the next payment.
   */
  readonly existingLoan = computed(() => {
    const v = this.values();
    const termInMonths = (v.termYears ?? 0) * 12;
    const made = paymentsMade(v.firstPaymentDate, new Date());
    if (made === 0 || termInMonths <= 0) return null;
    const borrowed = (v.homePrice ?? 0) - this.downPaymentAmount();
    return {
      made,
      next: made + 1,
      termInMonths,
      paidOff: made >= termInMonths,
      balance: balanceAfter(borrowed, v.annualInterestRate ?? 0, termInMonths, made),
    };
  });

  /** One-line summary of the rate type: fixed, a buydown, or an ARM and its caps. */
  readonly rateSummary = computed(() => {
    const v = this.values();
    if (this.sectionInvalid('rate')) return CHECK_SECTION;
    const summary = rateSummary(this.form.controls.rate, 'type', v.annualInterestRate ?? 0);
    const paidBy = v.rate?.rateType === 'buydown' ? ` · ${v.buydownPaidBy === 'Borrower' ? 'you pay for it' : 'the seller pays for it'}` : '';
    const points = pointsApply(v) ? ` · ${decimal(v.points ?? 0, 3)} point${v.points === 1 ? '' : 's'}` : '';
    return summary + paidBy + points;
  });

  /** True when points are chosen but their rate without them is not the higher one. */
  readonly pointsRateTooLow = computed(() => {
    const v = this.values();
    return pointsApply(v) && (v.rateWithoutPoints ?? 0) <= (v.annualInterestRate ?? 0);
  });

  /** True while discount points can be chosen: not on an adjustable rate. */
  readonly pointsOffered = computed(() => this.values().rate?.rateType !== 'arm');

  /** One-line summary of the extra payments beyond monthly, and what they are applied to. */
  readonly optionsSummary = computed(() => (this.sectionInvalid('options') ? CHECK_SECTION : optionsSummary(this.values())));

  constructor() {
    // Only the chosen way of entering taxes is checked and sent.
    syncTaxMode(this.form);
    this.form.controls.taxMode.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => syncTaxMode(this.form));

    // The adjustable rate's numbers are only checked (and sent) while the rate is adjustable.
    keepArmFieldsInStep(this.form.controls.rate);

    // The points' fields are only checked (and sent) while points apply.
    syncPoints(this.form);
    merge(this.form.controls.usePoints.valueChanges, this.form.controls.rate.controls.rateType.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => syncPoints(this.form));

    // Switching between $ and % converts the value, so the down payment itself stays the same.
    this.form.controls.downPaymentMode.valueChanges.pipe(takeUntilDestroyed()).subscribe((mode) => {
      const { homePrice, downPayment } = this.form.getRawValue();
      const converted = mode === 'percent'
        ? (homePrice > 0 ? toCents((downPayment / homePrice) * 100) : 0)
        : toCents((homePrice * downPayment) / 100);
      this.form.controls.downPayment.setValue(converted);
    });

    // Recalculate as the user types: every change that leaves the form valid produces a request.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.restoring && this.canSend()) this.calculate.emit(this.toRequest());
    });
  }

  /** The lump-sum rows, typed for the template. */
  get lumpSums(): FormArray<LumpSumForm> {
    return this.form.controls.lumpSums;
  }

  /** Loads the starting request, if any, then calculates at once so results appear without any input. */
  ngOnInit(): void {
    const initial = this.initial();
    if (initial) this.restore(initial);
    this.startFromSharedLoan();
    this.example = exampleUntilEdited(this.form, !initial && !this.sharedFrom(), this.destroyRef);
    this.submit();
  }

  /**
   * Fills in the loan changed on another page: the price is the home's value (or stays, when that page did not
   * ask), the down payment is what is not owed, and the term is the years left, to the nearest whole year.
   */
  private startFromSharedLoan(): void {
    const shared = this.loan();
    if (!shared) return;
    const { balance, annualInterestRate, remainingTermInMonths, homeValue, start } = shared.loan;
    // A loan whose start is known is taken as it started. Otherwise, a loan already being paid here keeps its start
    // and purchase price, and what was first borrowed is worked out from what is owed now; a new loan is bought
    // today, at the home's value.
    const firstPaymentDate = start?.firstPaymentDate ?? this.form.controls.firstPaymentDate.value;
    const made = paymentsMade(firstPaymentDate, new Date());
    const years = wholeYearsOf(start ? start.termInMonths : made + remainingTermInMonths);
    const borrowed = start ? start.amount : toCents(originalAmount(balance, annualInterestRate, years * 12, made));
    const price = Math.max(made > 0 ? this.form.controls.homePrice.value : (homeValue ?? this.form.controls.homePrice.value), borrowed);
    const wasPercent = this.form.controls.downPaymentMode.value !== 'amount';
    this.form.controls.downPaymentMode.setValue('amount', { emitEvent: false });
    const changed = setChanged(this.form, {
      homePrice: price,
      downPayment: toCents(price - borrowed),
      annualInterestRate,
      termYears: years,
      firstPaymentDate,
    });
    // The rate type too: an ARM's fixed period counts from the first payment here, from today when shared.
    const rateChanged = applySharedRate(this.form.controls.rate, shared.loan.rate, made);
    // Let the form's derived values (the loan summary, the existing-loan note) see the new numbers, without sending.
    this.restoring = true;
    this.form.updateValueAndValidity();
    this.restoring = false;
    if (changed || wasPercent || rateChanged) {
      const left = years * 12 - made;
      const wanted = start ? start.termInMonths - made : remainingTermInMonths;
      this.sharedFrom.set({
        from: shared.from,
        rounded: left === wanted ? null : { from: formatMonths(wanted), to: formatMonths(left) },
      });
    }
  }

  /** The tax-rate-change rows, typed for the template. */
  get rateChanges(): FormArray<RateChangeForm> {
    return this.form.controls.rateChanges;
  }

  /** Adds a tax rate change, from year 2 or the year after the last one, with its rates blank. */
  addRateChange(): void {
    const last = this.rateChanges.controls.at(-1)?.controls.fromYear.value ?? 1;
    this.rateChanges.push(rateChangeGroup(this.fb, last + 1));
  }

  /** Removes the tax rate change at `index`. */
  removeRateChange(index: number): void {
    this.rateChanges.removeAt(index);
  }

  /** Adds a lump-sum row, pre-filled with a $10,000 payment at month 12 (enough to qualify for a typical recast). */
  addLumpSum(): void {
    this.lumpSums.push(lumpSumGroup(this.fb, 12, 10_000));
  }

  /** Removes the lump-sum row at `index`. */
  removeLumpSum(index: number): void {
    this.lumpSums.removeAt(index);
  }

  /** True when a control should show its error: invalid and already interacted with. */
  showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  /** Emits the request if the form is valid; otherwise reveals every error. */
  submit(): void {
    if (!this.canSend()) {
      this.form.markAllAsTouched();
      return;
    }
    this.calculate.emit(this.toRequest());
  }

  /** True when the form can be sent: nothing wrong with it. */
  private canSend(): boolean {
    return this.currentProblems().length === 0;
  }

  /**
   * Everything wrong with the form: each invalid number, each invalid lump sum, nothing left to borrow, and, for a
   * loan already being paid, a loan that would be paid off already or a lump sum dated before the next payment.
   */
  private currentProblems(): string[] {
    const v = this.form.getRawValue();
    const existing = this.form.controls.termYears.valid ? this.existingLoan() : null;
    return [
      ...problemsIn(rules, this.form.controls),
      ...problemsIn(RATE_OPTION_RULES, this.form.controls.rate.controls),
      ...this.lumpSums.controls.flatMap((row) => problemsIn(LUMP_SUM_RULES, row.controls)),
      ...this.rateChanges.controls.flatMap((row) => problemsIn(RATE_CHANGE_RULES, row.controls)),
      ...(v.rateChanges.some((c) => c.fromYear > v.termYears) ? [`A tax rate change must start within the loan's ${v.termYears} years.`] : []),
      ...(this.form.controls.homePrice.valid && this.form.controls.downPayment.valid && v.homePrice - downPaymentAmountOf(v) <= 0
        ? [NOTHING_TO_BORROW] : []),
      ...(existing?.paidOff ? [PAID_OFF_ALREADY] : []),
      ...(v.loanProgram === 'Fha' && this.form.controls.homePrice.valid && this.form.controls.downPayment.valid
        && fhaDownProblem(downPaymentAmountOf(v), v.homePrice, v.creditScore) ? [fhaDownProblem(downPaymentAmountOf(v), v.homePrice, v.creditScore)!] : []),
      ...(pointsApply(v) && this.form.controls.rateWithoutPoints.valid && this.form.controls.annualInterestRate.valid
        && v.rateWithoutPoints <= v.annualInterestRate ? [POINTS_RATE_TOO_LOW] : []),
      ...(existing && !existing.paidOff
        ? v.lumpSums.filter((l) => l.paymentNumber < existing.next).map((l) => lumpSumInThePast(l.paymentNumber, existing.next))
        : []),
    ];
  }

  /** True when any control in `section` is invalid. */
  private sectionInvalid(section: keyof typeof SECTION_CONTROLS): boolean {
    return SECTION_CONTROLS[section].some((name) => this.form.controls[name].invalid);
  }

  /** Fills the form from a saved or last request, without sending a request for each of its changes. */
  private restore(r: AmortizationRequest): void {
    this.restoring = true;
    restoreLoanForm(this.form, this.fb, r);
    this.restoring = false;
  }

  /** The request for the form's values; on a loan already being paid, extra payments start with the next payment. */
  private toRequest(): AmortizationRequest {
    return toLoanRequest(this.form, (this.existingLoan()?.made ?? 0) + 1);
  }
}
