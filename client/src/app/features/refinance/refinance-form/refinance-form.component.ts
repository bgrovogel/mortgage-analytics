import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { problemsIn, problemsOf, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { setChanged } from '../../../core/forms/set-changed';
import { formatMonths } from '../../../core/formatting/duration';
import { PAID_OFF_ALREADY, balanceAfter, firstOfMonthFromNext, originalAmount, paymentsMade, toCents } from '../../../core/loans/loan-progress';
import { RefinanceRequest } from '../../../core/models/refinance.models';
import { SharedLoanChange } from '../../../core/state/shared-loan.store';
import { REFINANCE_RULES } from './refinance-fields';
import { RateOptionsComponent } from '../../../shared/rate-options/rate-options.component';
import { RATE_OPTION_RULES, applySharedRate, keepArmFieldsInStep, rateOptionsForm, rateOptionsRequest, rateSummary, setRateOptions } from '../../../shared/rate-options/rate-options';

/** The usual new terms, in years. "keep" means the new loan ends when the current one would. */
const TERMS = [30, 25, 20, 15, 10] as const;
type NewTerm = `${(typeof TERMS)[number]}` | 'keep';

/** How the loan today is described: by what is owed now, or by the loan as it was taken out. */
export type LoanEntry = 'today' | 'original';

const rules = REFINANCE_RULES;

/** The controls each way of describing the loan uses; the other way's are disabled, so they are not checked. */
const ENTRY_CONTROLS = {
  today: ['currentBalance', 'yearsLeft'],
  original: ['originalAmount', 'originalTermYears', 'firstPaymentDate'],
} as const;

/**
 * Presentational: the loan today and the refinance offer. Emits a ready-to-send request on load and
 * whenever a change leaves the form valid; the page sends it. The defaults are a worked example in which
 * the payment drops but the total cost rises, because the 30-year clock starts over.
 *
 * The loan today is either what is owed now, or the loan as it was taken out (amount, term, first payment), from
 * which the API works out what is owed today on that loan's own schedule. Switching converts one into the other,
 * so it stays the same loan.
 */
@Component({
  selector: 'app-refinance-form',
  imports: [ReactiveFormsModule, NumberFieldComponent, CurrencyPipe, RateOptionsComponent],
  templateUrl: './refinance-form.component.html',
  styleUrl: './refinance-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinanceFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** A comparison to start from (the last one) instead of the worked example. */
  readonly initial = input<RefinanceRequest | null>(null);

  /** A loan changed on another page since this one was last open: the form starts from it. */
  readonly loan = input<SharedLoanChange | null>(null);

  /** The page the loan was filled in from, when starting from the shared loan changed anything. */
  readonly sharedFrom = signal<string | null>(null);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly analyze = output<RefinanceRequest>();

  /** True while values are being loaded into the form, so its changes do not each send a request. */
  private restoring = false;

  protected readonly terms = TERMS;
  protected readonly rules = rules;
  protected readonly paidOffAlready = PAID_OFF_ALREADY;

  readonly form = this.fb.group({
    loanEntry: this.fb.control<LoanEntry>('today'),
    currentBalance: [300_000, validatorsFor(rules.currentBalance)],
    currentAnnualInterestRate: [7, validatorsFor(rules.currentAnnualInterestRate)],
    // Years, so people can answer from memory ("about 25 years left"); sent as months.
    yearsLeft: [25, validatorsFor(rules.yearsLeft)],
    originalAmount: [{ value: 0, disabled: true }, validatorsFor(rules.originalAmount)],
    originalTermYears: [{ value: 30, disabled: true }, validatorsFor(rules.originalTermYears)],
    firstPaymentDate: [{ value: '', disabled: true }, Validators.required],
    newAnnualInterestRate: [6, validatorsFor(rules.newAnnualInterestRate)],
    newTerm: this.fb.control<NewTerm>('30'),
    closingCosts: [6_000, validatorsFor(rules.closingCosts)],
    financeClosingCosts: [false],
    // Each loan's rate: the current one may adjust (its next reset two years off, expected two points higher);
    // the new one may adjust (a 7/1 by default) or be bought down.
    currentRate: rateOptionsForm(this.fb, 9, 24),
    newRate: rateOptionsForm(this.fb, 7.5),
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Emits what is wrong whenever that changes: an empty list once every field is valid again. */
  readonly problems = outputFromObservable(problemsOf(this.form, () => this.currentProblems()));

  /** One line for each loan's closed rate section. */
  readonly currentRateSummary = computed(() => rateSummary(this.form.controls.currentRate, 'reset', this.values().currentAnnualInterestRate ?? 0));
  readonly newRateSummary = computed(() => rateSummary(this.form.controls.newRate, 'type', this.values().newAnnualInterestRate ?? 0));

  /** True while the loan is described as it was taken out. */
  readonly byOriginalLoan = computed(() => this.values().loanEntry === 'original');

  /**
   * The original loan as it stands today: the payments behind it, the next one, and about what is owed. Null while
   * the loan is described by what is owed now.
   */
  readonly loanToday = computed(() => {
    const v = this.form.getRawValue();
    this.values(); // re-read on every change
    if (v.loanEntry !== 'original') return null;
    const termInMonths = Math.round(v.originalTermYears * 12);
    const made = paymentsMade(v.firstPaymentDate, new Date());
    return {
      made,
      next: made + 1,
      termInMonths,
      paidOff: made >= termInMonths,
      balance: toCents(balanceAfter(v.originalAmount, v.currentAnnualInterestRate, termInMonths, made)),
    };
  });

  /** Payments left on the current loan. */
  readonly remainingMonths = computed(() => {
    const today = this.loanToday();
    return today ? today.termInMonths - today.made : Math.round((this.values().yearsLeft ?? 0) * 12);
  });

  /** "25 years", or "22 yr 6 mo" for part years, for the keep-my-payoff-date option. */
  readonly remainingLabel = computed(() => {
    const months = this.remainingMonths();
    return months % 12 === 0 ? `${months / 12} years` : formatMonths(months);
  });

  constructor() {
    // Switching how the loan is described converts the one into the other, so it stays the same loan.
    this.form.controls.loanEntry.valueChanges.pipe(takeUntilDestroyed()).subscribe((entry) => this.describeBy(entry));
    keepArmFieldsInStep(this.form.controls.currentRate);
    keepArmFieldsInStep(this.form.controls.newRate);

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.restoring && this.canSend()) this.analyze.emit(this.toRequest());
    });
  }

  /** Loads the starting request, if any, then compares at once. */
  ngOnInit(): void {
    const initial = this.initial();
    if (initial) {
      const original = initial.originalLoan;
      this.enableFor(original ? 'original' : 'today');
      setRateOptions(this.form.controls.currentRate, null, initial.currentAdjustableRate);
      setRateOptions(this.form.controls.newRate, initial.newBuydown, initial.newAdjustableRate);
      this.form.patchValue(
        {
          loanEntry: original ? 'original' : 'today',
          currentBalance: initial.currentBalance,
          currentAnnualInterestRate: initial.currentAnnualInterestRate,
          yearsLeft: initial.remainingTermInMonths / 12,
          originalAmount: original?.amount ?? 0,
          originalTermYears: original ? original.termInMonths / 12 : 30,
          firstPaymentDate: original?.firstPaymentDate ?? '',
          newAnnualInterestRate: initial.newAnnualInterestRate,
          newTerm: initial.newTermInMonths === initial.remainingTermInMonths ? 'keep' : (`${initial.newTermInMonths / 12}` as NewTerm),
          closingCosts: initial.closingCosts,
          financeClosingCosts: initial.financeClosingCosts,
        },
        { emitEvent: false },
      );
    }
    this.startFromSharedLoan();
    // Let everything derived from the values (payments left, the original loan today, the problems) see them.
    this.restoring = true;
    this.form.updateValueAndValidity();
    this.restoring = false;
    if (this.canSend()) this.analyze.emit(this.toRequest());
  }

  /** Fills in the loan changed on another page: as it was taken out when that page knows, otherwise as it is now. */
  private startFromSharedLoan(): void {
    const shared = this.loan();
    if (!shared) return;
    const { balance, annualInterestRate, remainingTermInMonths, start } = shared.loan;
    const entry: LoanEntry = start ? 'original' : 'today';
    const entryChanged = this.form.controls.loanEntry.value !== entry;
    this.enableFor(entry);
    this.form.controls.loanEntry.setValue(entry, { emitEvent: false });
    const changed = setChanged(this.form, start
      ? { currentAnnualInterestRate: annualInterestRate, originalAmount: start.amount, originalTermYears: start.termInMonths / 12, firstPaymentDate: start.firstPaymentDate }
      : { currentBalance: balance, currentAnnualInterestRate: annualInterestRate, yearsLeft: remainingTermInMonths / 12 });
    // The rate type too: the current loan's ARM counts from its first payment when the original loan is known.
    const made = start ? paymentsMade(start.firstPaymentDate, new Date()) : 0;
    const rateChanged = applySharedRate(this.form.controls.currentRate, shared.loan.rate, made, false);
    if (changed || entryChanged || rateChanged) this.sharedFrom.set(shared.from);
  }

  /**
   * Describes the same loan the other way: from what is owed now, the original loan whose schedule leaves that
   * balance after the payments made (a 30-year loan, or longer when more is left); from the original loan, what is
   * owed today and the payments left.
   */
  private describeBy(entry: LoanEntry): void {
    const v = this.form.getRawValue();
    if (entry === 'original') {
      const left = Math.round(v.yearsLeft * 12);
      const termYears = Math.max(30, Math.ceil(left / 12));
      const made = termYears * 12 - left;
      this.form.patchValue({
        originalAmount: toCents(originalAmount(v.currentBalance, v.currentAnnualInterestRate, termYears * 12, made)),
        originalTermYears: termYears,
        firstPaymentDate: firstOfMonthFromNext(-made),
      }, { emitEvent: false });
    } else {
      const today = this.loanToday();
      if (today && !today.paidOff) {
        this.form.patchValue({ currentBalance: today.balance, yearsLeft: (today.termInMonths - today.made) / 12 }, { emitEvent: false });
      }
    }
    this.enableFor(entry);
  }

  /** Enables the controls for one way of describing the loan, and disables the other's. */
  private enableFor(entry: LoanEntry): void {
    for (const name of ENTRY_CONTROLS[entry]) this.form.controls[name].enable({ emitEvent: false });
    for (const name of ENTRY_CONTROLS[entry === 'today' ? 'original' : 'today']) this.form.controls[name].disable({ emitEvent: false });
  }

  /** Everything wrong with the form, including an original loan whose term is already behind it. */
  private currentProblems(): string[] {
    return [
      ...problemsIn(rules, this.form.controls),
      ...problemsIn(RATE_OPTION_RULES, this.form.controls.currentRate.controls),
      ...problemsIn(RATE_OPTION_RULES, this.form.controls.newRate.controls),
      ...(this.loanToday()?.paidOff ? [PAID_OFF_ALREADY] : []),
    ];
  }

  /**
   * True when the form can be sent: nothing wrong with it. It checks the form's own validity rather than the problems
   * list, because the first payment date (required while it is shown) is not a numeric field with a rule.
   */
  private canSend(): boolean {
    return this.form.valid && !this.loanToday()?.paidOff;
  }

  /** What the current loan's fixed period counts from: the next payment, or the original first one. */
  protected currentResetLabel(): string {
    return this.byOriginalLoan() ? 'Fixed for (payments from the first)' : 'Next reset in (payments)';
  }

  private toRequest(): RefinanceRequest {
    const v = this.form.getRawValue();
    const today = this.loanToday();
    const remaining = this.remainingMonths();
    const newRate = rateOptionsRequest(this.form.controls.newRate, 'type');
    return {
      // With the original loan, the API works these out itself, to the cent; these are close, for the other pages.
      currentBalance: today ? today.balance : v.currentBalance,
      currentAnnualInterestRate: v.currentAnnualInterestRate,
      remainingTermInMonths: remaining,
      nextPaymentDate: null,
      newAnnualInterestRate: v.newAnnualInterestRate,
      newTermInMonths: v.newTerm === 'keep' ? remaining : Number(v.newTerm) * 12,
      closingCosts: v.closingCosts,
      financeClosingCosts: v.financeClosingCosts,
      originalLoan: today
        ? { amount: v.originalAmount, termInMonths: Math.round(v.originalTermYears * 12), firstPaymentDate: v.firstPaymentDate }
        : null,
      currentAdjustableRate: rateOptionsRequest(this.form.controls.currentRate, 'reset').adjustableRate,
      newAdjustableRate: newRate.adjustableRate,
      newBuydown: newRate.buydown,
    };
  }
}
