import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, Signal, computed, effect, forwardRef, inject, input, output, signal, untracked } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { merge } from 'rxjs';
import { problemsIn, problemsOf } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { exampleUntilEdited } from '../../../core/forms/example-until-edited';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { AverageRateComponent } from '../../../shared/average-rate/average-rate.component';
import { NumberInputDirective } from '../../../core/forms/number-input.directive';
import { setChanged } from '../../../core/forms/set-changed';
import { UndoHistory } from '../../../core/forms/undo-history';
import { formatMonths } from '../../../core/formatting/duration';
import { decimal } from '../../../core/formatting/format';
import { SharedLoanChange } from '../../../core/state/shared-loan.store';
import { AmortizationRequest, OccupancyType, YearProjection } from '../../../core/models/amortization.models';
import { balanceAfter, biweeklyExtra, monthlyPayment, originalAmount, paidOffAlready, paymentsMade, toCents } from '../../../core/loans/loan-progress';
import { CO_BUYER_RULES, LOAN_RULES, LUMP_SUM_RULES, MAX_CO_BUYERS, RATE_CHANGE_RULES, wholeYearsOf } from './loan-fields';
import { currentBuyView } from '../buy-tabs/buy-tabs.component';
import { LOAN_FORM } from './loan-form.token';
import { ClosingSectionComponent } from './sections/closing-section.component';
import { CostsSectionComponent } from './sections/costs-section.component';
import { ExtraPaymentsSectionComponent } from './sections/extra-payments-section.component';
import { GrowthSectionComponent } from './sections/growth-section.component';
import { CoBuyersComponent } from './sections/co-buyers.component';
import { IncomeSectionComponent } from './sections/income-section.component';
import { LoanTypeSectionComponent } from './sections/loan-type-section.component';
import { RATE_OPTION_RULES, applySharedRate, keepArmFieldsInStep, rateSummary } from '../../../shared/rate-options/rate-options';
import {
  CoBuyerForm, LoanForm, LumpSumForm, coBuyerGroup, coBuyerSharesProblem, RateChangeForm, chargedTaxes, conventionalDownProblem, fhaDownProblem, occupancyProblem, syncOccupancy, rateChangeGroup, rateChangesOf, POINTS_RATE_TOO_LOW, downPaymentAmountOf, loanForm, lumpSumGroup, pointsApply, restoreLoanForm, syncPoints, syncTaxMode, toLoanRequest,
} from './loan-form.model';
import { closingSummary, costsSummary, growthSummary, incomeSummary, optionsSummary, taxesSummary } from './loan-form.summaries';
import { TPipe } from '../../../core/i18n/t.pipe';
import { msg, t, tp } from '../../../core/i18n/i18n';

const rules = LOAN_RULES;

/** Shown while the down payment leaves nothing to borrow. */
export const NOTHING_TO_BORROW = msg('The down payment must be less than the home price.');

/** Shown for a lump sum on a payment already made. */
const lumpSumInThePast = (paymentNumber: number, next: number) =>
  t('A lump sum with payment #{0} is in the past: payment #{1} is next.', [paymentNumber, next]);

/** Shown in a section's summary when one of its fields is invalid, so the problem is not hidden by collapsing. */
const checkSection = () => t('Check the values in this section');

/** Controls inside each collapsible section, used to flag a closed section that holds an invalid value. */
const SECTION_CONTROLS = {
  taxes: ['propertyTaxRate', 'propertyTaxHomesteadExemption', 'schoolTaxRate', 'localTaxRate', 'mudTaxRate', 'pidAnnual', 'pidYears', 'schoolHomesteadExemption',
    'localHomesteadExemptionPercent', 'mudHomesteadExemptionPercent', 'homesteadAssessmentCap', 'over65Year', 'over65SchoolExemption', 'over65LocalExemption',
    'transferredCeilingPercent', 'rateChanges'],
  costs: ['annualInsurance', 'monthlyHoa', 'pmiRate'],
  program: ['creditScore'],
  closing: ['loanCosts', 'otherFees', 'prepaidInterestDays', 'escrowMonths', 'closingCredits', 'lenderCredits'],
  income: ['annualIncome', 'monthlyDebts', 'coBuyers', 'monthlyBudget'],
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
/** How the loan's summary names a home not lived in. */
const conventionalFor = (occupancy: OccupancyType): string =>
  ({ PrimaryResidence: t('Conventional'), SecondHome: t('Conventional · second home'), InvestmentProperty: t('Conventional · investment property') })[occupancy];

/**
 * An FHA loan's down-payment problem by credit score, or a conventional loan's by the home's use; null for VA, and
 * for a conventional loan already being paid, whose limits were for when it was made.
 */
function downProblemOf(v: ReturnType<LoanForm['getRawValue']>, adjustableRate: boolean): string | null {
  const down = downPaymentAmountOf(v);
  const price = v.homePrice;
  if (v.loanProgram === 'Fha') return fhaDownProblem(down, price, v.creditScore);
  if (v.loanProgram === 'Va' || paymentsMade(v.firstPaymentDate, new Date()) > 0) return null;
  return conventionalDownProblem(down, price, v.occupancy, adjustableRate);
}

@Component({
  selector: 'app-loan-form',
  imports: [
    ReactiveFormsModule, CurrencyPipe, DecimalPipe, NumberFieldComponent, NumberInputDirective, AverageRateComponent,
    LoanTypeSectionComponent, CostsSectionComponent, ClosingSectionComponent, CoBuyersComponent, IncomeSectionComponent, ExtraPaymentsSectionComponent, GrowthSectionComponent, TPipe,
  ],
  // The sections read the form from here.
  providers: [{ provide: LOAN_FORM, useExisting: forwardRef(() => LoanFormComponent) }],
  templateUrl: './loan-form.component.html',
  styleUrl: './loan-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** A request to start from (the last calculation, or a saved one) instead of the worked example. */
  readonly initial = input<AmortizationRequest | null>(null);

  /** The form's heading: "Your numbers", or which home it is when two are compared. */
  readonly heading = input('Your numbers');

  /** The view of buying open: income and debts come up beside the five numbers when it asks whether a home can be afforded. */
  readonly view = currentBuyView();

  /** False for a compared home: only the calculator's own loan is shared with the other pages. */
  readonly shared = input(true);

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

  /** What the numbers were before each change the visitor made, for Undo. */
  private readonly undoHistory = new UndoHistory<AmortizationRequest | null>(null);

  /** True when there is a change to take back. */
  readonly canUndo = this.undoHistory.canUndo;

  readonly rules = rules;
  readonly lumpSumRules = LUMP_SUM_RULES;
  readonly coBuyerRules = CO_BUYER_RULES;
  readonly rateChangeRules = RATE_CHANGE_RULES;
  protected readonly nothingToBorrow = NOTHING_TO_BORROW;
  protected readonly paidOffAlready = paidOffAlready;
  readonly pointsRateMessage = POINTS_RATE_TOO_LOW;

  readonly form = loanForm(this.fb);

  readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Emits what is wrong whenever that changes: an empty list once the form can be sent again. */
  readonly problems = outputFromObservable(problemsOf(this.form, () => this.currentProblems()));

  /** The down payment in dollars, whichever unit it was entered in. */
  readonly downPaymentAmount = computed(() => downPaymentAmountOf(this.values()));

  /** Loan amount derived live from price and down payment, shown under the down payment field. */
  readonly loanAmount = computed(() => Math.max(0, (this.values().homePrice ?? 0) - this.downPaymentAmount()));

  /**
   * What paying every two weeks would add each month, offered until it is the monthly extra: the loan's payment
   * over twelve, since half a payment every two weeks is thirteen payments a year. Null without a loan, or once the
   * extra is that amount.
   */
  readonly biweekly = computed(() => {
    const v = this.values();
    const loan = this.loanAmount();
    const term = (v.termYears ?? 0) * 12;
    if (loan <= 0 || term <= 0 || v.annualInterestRate === null || v.annualInterestRate === undefined) return null;
    const extra = biweeklyExtra(monthlyPayment(loan, v.annualInterestRate, term));
    return extra > 0 && v.monthlyExtra !== extra ? extra : null;
  });

  /** Sets the monthly extra to the biweekly equivalent. */
  useBiweekly(): void {
    const extra = this.biweekly();
    if (extra !== null) this.form.controls.monthlyExtra.setValue(extra);
  }

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

  /** How the buyer will use the home. */
  readonly occupancy = computed(() => this.values().occupancy ?? 'PrimaryResidence');

  /**
   * What stops the down payment from being sent, or null: an FHA loan's minimum by credit score, or a conventional
   * loan's by the home's use and whether the rate is adjustable.
   */
  readonly downProblem = computed(() => {
    const v = this.values(); // read for its changes; the raw value also has the fields disabled for now
    return downProblemOf(this.form.getRawValue(), v.rate?.rateType === 'arm');
  });

  /** What stops the loan type for this home's use, or null: FHA and VA are only for a home lived in. */
  readonly occupancyProblem = computed(() => occupancyProblem(this.loanProgram(), this.occupancy()));

  /** One-line summary of the loan type, and for FHA or VA how its fee is paid. */
  readonly programSummary = computed(() => {
    const v = this.values();
    const atClosing = v.financeUpfrontFee === false;
    if (v.loanProgram === 'Fha') return atClosing ? t('FHA · upfront MIP paid at closing') : t('FHA · upfront MIP added to the loan');
    if (v.loanProgram !== 'Va') return conventionalFor(v.occupancy ?? 'PrimaryResidence');
    if (v.vaUse === 'Exempt') return t('VA · exempt from the funding fee');
    if (v.vaUse === 'SubsequentUse') return atClosing ? t('VA · used before · funding fee paid at closing') : t('VA · used before · funding fee added to the loan');
    return atClosing ? t('VA · first use · funding fee paid at closing') : t('VA · first use · funding fee added to the loan');
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
      ? checkSection()
      : taxesSummary(this.values(), { homestead: this.isHomestead(), over65: this.isOver65(), rateChanges: rateChangesOf(this.values()).length }));

  /** The taxes charged, whose rates a rate change can change. */
  readonly chargedTaxes = computed(() => chargedTaxes(this.values()));

  /** One-line summary of the insurance, HOA and PMI section. */
  readonly costsSummary = computed(() =>
    this.sectionInvalid('costs') ? checkSection() : costsSummary(this.values(), { pmiApplies: this.pmiApplies() }));

  /** One-line summary of the closing-costs section. */
  readonly closingSummary = computed(() => (this.sectionInvalid('closing') ? checkSection() : closingSummary(this.values())));

  /** One-line summary of the yearly-increase assumptions. */
  readonly incomeSummary = computed(() => (this.sectionInvalid('income') ? checkSection() : incomeSummary(this.values())));
  readonly growthSummary = computed(() => (this.sectionInvalid('growth') ? checkSection() : growthSummary(this.values())));

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
    if (this.sectionInvalid('rate')) return checkSection();
    const summary = rateSummary(this.form.controls.rate, 'type', v.annualInterestRate ?? 0);
    const paidBy = v.rate?.rateType === 'buydown' ? (v.buydownPaidBy === 'Borrower' ? t('you pay for it') : t('the seller pays for it')) : '';
    const points = pointsApply(v) ? tp(v.points ?? 0, '{p} point', '{p} points', { p: decimal(v.points ?? 0, 3) }) : '';
    return [summary, paidBy, points].filter(Boolean).join(' · ');
  });

  /** True when points are chosen but their rate without them is not the higher one. */
  readonly pointsRateTooLow = computed(() => {
    const v = this.values();
    return pointsApply(v) && (v.rateWithoutPoints ?? 0) <= (v.annualInterestRate ?? 0);
  });

  /** True while discount points can be chosen: not on an adjustable rate. */
  readonly pointsOffered = computed(() => this.values().rate?.rateType !== 'arm');

  /** One-line summary of the extra payments beyond monthly, and what they are applied to. */
  readonly optionsSummary = computed(() => (this.sectionInvalid('options') ? checkSection() : optionsSummary(this.values())));

  constructor() {
    // Only the chosen way of entering taxes is checked and sent.
    syncTaxMode(this.form);
    this.form.controls.taxMode.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => syncTaxMode(this.form));

    // The adjustable rate's numbers are only checked (and sent) while the rate is adjustable.
    keepArmFieldsInStep(this.form.controls.rate);

    // A homestead is only offered for the home the buyer lives in (the form starts as one, with it on).
    this.form.controls.occupancy.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => syncOccupancy(this.form));

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
      if (!this.restoring && this.canSend()) {
        const request = this.toRequest();
        this.undoHistory.note(request);
        this.calculate.emit(request);
      }
    });

    // A result asking for one of the loan's inputs ("Add your income") opens its section and puts the cursor in it.
    // Only the calculator's own loan answers, and only requests made after this form was: not one it was built after.
    const navigator = inject(FormNavigator);
    const host: HTMLElement = inject(ElementRef).nativeElement;
    const before = navigator.requested();
    const pricedBefore = navigator.pricing();
    effect(() => {
      const priced = navigator.pricing();
      if (!priced || priced === pricedBefore || !untracked(this.shared)) return;
      this.priceHomeAt(priced.price);
    });
    effect(() => {
      const to = navigator.requested();
      if (!to || to === before || !untracked(this.shared)) return;
      const section = host.querySelector<HTMLDetailsElement>(`[data-testid="section-${to.section}"]`);
      if (section) section.open = true;
      const field = host.querySelector<HTMLInputElement>(`[data-testid="${to.field}"]`);
      field?.scrollIntoView({ block: 'center' });
      field?.focus({ preventScroll: true });
    });
  }

  /** Prices the home at `price` and keeps the share of it put down, as a lender's "most you could buy" assumes. */
  private priceHomeAt(price: number): void {
    const { homePrice, downPayment, downPaymentMode } = this.form.getRawValue();
    const down = downPaymentMode === 'percent' || homePrice <= 0 ? downPayment : Math.ceil(((price * downPayment) / homePrice) * 100) / 100;
    this.form.patchValue({ homePrice: price, downPayment: down });
  }

  /** The lump-sum rows, typed for the template. */
  get lumpSums(): FormArray<LumpSumForm> {
    return this.form.controls.lumpSums;
  }

  get coBuyers(): FormArray<CoBuyerForm> {
    return this.form.controls.coBuyers;
  }

  /** Loads the starting request, if any, then calculates at once so results appear without any input. */
  ngOnInit(): void {
    const initial = this.initial();
    if (initial) this.restore(initial);
    this.startFromSharedLoan();
    this.example = exampleUntilEdited(this.form, !initial && !this.sharedFrom(), this.destroyRef);
    this.undoHistory.reset(this.canSend() ? this.toRequest() : null);
    this.submit();
  }

  /**
   * Puts the worked example back, every section included, and calculates it: the way out after a few edits that
   * leaves nothing to clear field by field. It is the example again, so its note comes back too.
   */
  resetToExample(): void {
    this.restore(toLoanRequest(loanForm(this.fb), 1));
    this.sharedFrom.set(null);
    this.example = exampleUntilEdited(this.form, true, this.destroyRef);
    // Starting over is a step like any other: it can be undone.
    this.undoHistory.note(this.canSend() ? this.toRequest() : null);
    this.submit();
  }

  /** Takes back the last change: the numbers before it, calculated again. */
  undo(): void {
    const previous = this.undoHistory.undo();
    if (!previous) return;
    this.restore(previous);
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

  /** True while another co-buyer may be added: a few people buy together, not a crowd. */
  canAddCoBuyer(): boolean {
    return this.coBuyers.length < MAX_CO_BUYERS;
  }

  /** Adds a co-buyer: their income to be given, and no share of the down payment yet. */
  addCoBuyer(): void {
    if (this.canAddCoBuyer()) this.coBuyers.push(coBuyerGroup(this.fb, null, null, 0));
  }

  /** Removes the co-buyer at `index`. */
  removeCoBuyer(index: number): void {
    this.coBuyers.removeAt(index);
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
      ...this.coBuyers.controls.flatMap((row) => problemsIn(CO_BUYER_RULES, row.controls)),
      ...coBuyerSharesProblem(v.coBuyers),
      ...this.rateChanges.controls.flatMap((row) => problemsIn(RATE_CHANGE_RULES, row.controls)),
      ...(v.rateChanges.some((c) => c.fromYear > v.termYears) ? [t("A tax rate change must start within the loan's {0} years.", [v.termYears])] : []),
      ...(this.form.controls.homePrice.valid && this.form.controls.downPayment.valid && v.homePrice - downPaymentAmountOf(v) <= 0
        ? [t(NOTHING_TO_BORROW)] : []),
      ...(existing?.paidOff ? [paidOffAlready()] : []),
      ...(this.form.controls.homePrice.valid && this.form.controls.downPayment.valid && v.homePrice - downPaymentAmountOf(v) > 0
        ? [downProblemOf(v, v.rate.rateType === 'arm')].filter((p): p is string => p !== null) : []),
      ...[occupancyProblem(v.loanProgram, v.occupancy)].filter((p): p is string => p !== null),
      ...(pointsApply(v) && this.form.controls.rateWithoutPoints.valid && this.form.controls.annualInterestRate.valid
        && v.rateWithoutPoints <= v.annualInterestRate ? [t(POINTS_RATE_TOO_LOW)] : []),
      ...(existing && !existing.paidOff
        ? v.lumpSums.filter((l) => l.paymentNumber < existing.next).map((l) => lumpSumInThePast(l.paymentNumber, existing.next))
        : []),
    ];
  }

  /** True when any control in `section` is invalid. */
  private sectionInvalid(section: keyof typeof SECTION_CONTROLS): boolean {
    // A control's status is not a signal: reading the values (which change when it does) makes a summary built on this
    // recompute as the form is fixed, rather than stay on "Check the values" because it read nothing while invalid.
    this.values();
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
