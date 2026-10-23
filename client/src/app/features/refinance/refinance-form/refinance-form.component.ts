import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, Signal, computed, inject, input, output, signal } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { exampleUntilEdited } from '../../../core/forms/example-until-edited';
import { problemsIn, problemsOf, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { setChanged } from '../../../core/forms/set-changed';
import { formatMonths } from '../../../core/formatting/duration';
import { usd as usdWhole } from '../../../core/formatting/format';
import { balanceAfter, firstOfMonthFromNext, originalAmount, paidOffAlready, paymentsMade, toCents } from '../../../core/loans/loan-progress';
import { RefinanceRequest } from '../../../core/models/refinance.models';
import { SharedLoanChange } from '../../../core/state/shared-loan.store';
import { REFINANCE_RULES } from './refinance-fields';
import { AverageRateComponent } from '../../../shared/average-rate/average-rate.component';
import { RateOptionsComponent } from '../../../shared/rate-options/rate-options.component';
import { RATE_OPTION_RULES, applySharedRate, keepArmFieldsInStep, rateOptionsForm, rateOptionsRequest, rateSummary, setRateOptions } from '../../../shared/rate-options/rate-options';
import { TPipe } from '../../../core/i18n/t.pipe';
import { msg, t } from '../../../core/i18n/i18n';

/** The usual new terms, in years. "keep" means the new loan ends when the current one would. */
const TERMS = [30, 25, 20, 15, 10] as const;
type NewTerm = `${(typeof TERMS)[number]}` | 'keep';

/** How the loan today is described: by what is owed now, or by the loan as it was taken out. */
export type LoanEntry = 'today' | 'original';

const rules = REFINANCE_RULES;

/** What the cash out is borrowed as: a fixed-rate loan, or a line of credit (drawn, interest only, then repaid). */
type EquityKind = 'loan' | 'line';

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
  imports: [ReactiveFormsModule, NumberFieldComponent, CurrencyPipe, RateOptionsComponent, AverageRateComponent, TPipe],
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

  /** On a phone the sheet asks one question at a time: the loan as it stands, then the new one. */
  protected readonly step = signal<'today' | 'new'>('today');

  /** The verdict as it stands, in a line, to dock beside the new loan's fields: what the page's answer says now. */
  readonly verdict = input<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);

  /** True while the form shows its worked example, until the visitor's first edit (see exampleUntilEdited). */
  protected example: Signal<boolean> = signal(false);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly analyze = output<RefinanceRequest>();

  /** True while values are being loaded into the form, so its changes do not each send a request. */
  private restoring = false;

  protected readonly terms = TERMS;
  protected readonly rules = rules;
  protected readonly paidOffAlready = paidOffAlready;

  readonly form = this.fb.group({
    loanEntry: this.fb.control<LoanEntry>('today'),
    currentBalance: [300_000, validatorsFor(rules.currentBalance)],
    currentAnnualInterestRate: [7, validatorsFor(rules.currentAnnualInterestRate)],
    // Years, so people can answer from memory ("about 28 years left"); sent as months.
    yearsLeft: [28, validatorsFor(rules.yearsLeft)],
    originalAmount: [{ value: 0, disabled: true }, validatorsFor(rules.originalAmount)],
    originalTermYears: [{ value: 30, disabled: true }, validatorsFor(rules.originalTermYears)],
    firstPaymentDate: [{ value: '', disabled: true }, Validators.required],
    // About the average 30-year fixed rate today.
    newAnnualInterestRate: [6.25, validatorsFor(rules.newAnnualInterestRate)],
    newTerm: this.fb.control<NewTerm>('30'),
    closingCosts: [6_000, validatorsFor(rules.closingCosts)],
    cashOut: [0, validatorsFor(rules.cashOut)],
    financeClosingCosts: [false],
    // The home's value sets whether each loan carries PMI: while it is above 80% of it.
    homeValue: [400_000, validatorsFor(rules.homeValue)],
    currentMonthlyPmi: [0, validatorsFor(rules.currentMonthlyPmi)],
    newPmiRate: [0.5, validatorsFor(rules.newPmiRate)],
    // A home-equity loan for the cash out, to compare with refinancing for it: about today's rate on one, 15 years, kept 7.
    // Or a line of credit: drawn (interest only) for 10 years, then repaid over the term at the rate expected by then.
    // The fields of a comparison that is not asked for, and a line's when it is a loan, are disabled so they are not checked.
    compareEquityLoan: [false],
    equityKind: ['loan' as EquityKind],
    equityRate: [{ value: 8, disabled: true }, validatorsFor(rules.equityRate)],
    equityTermYears: [{ value: 15, disabled: true }, validatorsFor(rules.equityTermYears)],
    equityYearsKept: [{ value: 7, disabled: true }, validatorsFor(rules.equityYearsKept)],
    equityDrawYears: [{ value: 10, disabled: true }, validatorsFor(rules.equityDrawYears)],
    equityRepaymentRate: [{ value: 8, disabled: true }, validatorsFor(rules.equityRepaymentRate)],
    // Each loan's rate: the current one may adjust (its next reset two years off, expected two points higher);
    // the new one may adjust (a 7/1 by default) or be bought down.
    currentRate: rateOptionsForm(this.fb, 9, 24),
    newRate: rateOptionsForm(this.fb, 7.25),
  });

  protected readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** The new loan's term in years, or null while it is "my payoff date" (which is no whole term to match an average to). */
  protected readonly newTermYears = computed(() => Number(this.values().newTerm) || null);

  /** Emits what is wrong whenever that changes: an empty list once every field is valid again. */
  readonly problems = outputFromObservable(problemsOf(this.form, () => this.currentProblems()));

  /** One line for each loan's closed rate section. */
  readonly currentRateSummary = computed(() => rateSummary(this.form.controls.currentRate, 'reset', this.values().currentAnnualInterestRate ?? 0));
  readonly newRateSummary = computed(() => rateSummary(this.form.controls.newRate, 'type', this.values().newAnnualInterestRate ?? 0));

  /** The closed "Cash out and PMI" section's line: what is taken out, and the new loan's PMI rate. */
  readonly extrasSummary = computed(() => {
    const v = this.values();
    const cash = v.cashOut ? t('Cash out {0}', [usdWhole(v.cashOut)]) : t('No cash out');
    return v.newPmiRate ? t('{0} · PMI {1}%', [cash, v.newPmiRate]) : cash;
  });

  /** True when the home-equity loan's fields are shown and sent: cash is taken out and the comparison is asked for. */
  readonly comparesEquityLoan = computed(() => !!this.values().cashOut && !!this.values().compareEquityLoan);

  /** True when what is compared is a line of credit, whose draw period and repayment rate are shown and sent. */
  readonly comparesEquityLine = computed(() => this.comparesEquityLoan() && this.values().equityKind === 'line');

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

  /** "25 years", or "22 yr 6 mo" for part years, for the line under "My payoff date". */
  readonly remainingLabel = computed(() => {
    const months = this.remainingMonths();
    return months % 12 === 0 ? t('{0} years', [months / 12]) : formatMonths(months);
  });

  constructor() {
    // Switching how the loan is described converts the one into the other, so it stays the same loan.
    this.form.controls.loanEntry.valueChanges.pipe(takeUntilDestroyed()).subscribe((entry) => this.describeBy(entry));
    keepArmFieldsInStep(this.form.controls.currentRate);
    keepArmFieldsInStep(this.form.controls.newRate);

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.checkEquityFieldsShown();
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
          cashOut: initial.cashOut ?? 0,
          financeClosingCosts: initial.financeClosingCosts,
          ...(initial.homeValue == null ? {} : { homeValue: initial.homeValue }),
          currentMonthlyPmi: initial.currentMonthlyPmi ?? 0,
          newPmiRate: initial.newPmiRate ?? 0.5,
          compareEquityLoan: !!initial.homeEquityLoan,
          ...(initial.homeEquityLoan
            ? {
              equityKind: initial.homeEquityLoan.drawPeriodInMonths ? ('line' as const) : ('loan' as const),
              equityRate: initial.homeEquityLoan.annualInterestRate,
              equityTermYears: initial.homeEquityLoan.termInMonths / 12,
              equityYearsKept: initial.homeEquityLoan.yearsKept,
              ...(initial.homeEquityLoan.drawPeriodInMonths ? { equityDrawYears: initial.homeEquityLoan.drawPeriodInMonths / 12 } : {}),
              equityRepaymentRate: initial.homeEquityLoan.repaymentRate ?? initial.homeEquityLoan.annualInterestRate,
            }
            : {}),
        },
        { emitEvent: false },
      );
    }
    this.startFromSharedLoan();
    this.checkEquityFieldsShown();
    // Let everything derived from the values (payments left, the original loan today, the problems) see them.
    this.restoring = true;
    this.form.updateValueAndValidity();
    this.restoring = false;
    this.example = exampleUntilEdited(this.form, !initial && !this.sharedFrom(), this.destroyRef);
    if (this.canSend()) this.analyze.emit(this.toRequest());
  }

  /** Fills in the loan changed on another page: as it was taken out when that page knows, otherwise as it is now. */
  private startFromSharedLoan(): void {
    const shared = this.loan();
    if (!shared) return;
    const { balance, annualInterestRate, remainingTermInMonths, start, homeValue, monthlyPmi } = shared.loan;
    const entry: LoanEntry = start ? 'original' : 'today';
    const entryChanged = this.form.controls.loanEntry.value !== entry;
    this.enableFor(entry);
    this.form.controls.loanEntry.setValue(entry, { emitEvent: false });
    const changed = setChanged(this.form, {
      ...(start
        ? { currentAnnualInterestRate: annualInterestRate, originalAmount: start.amount, originalTermYears: start.termInMonths / 12, firstPaymentDate: start.firstPaymentDate }
        : { currentBalance: balance, currentAnnualInterestRate: annualInterestRate, yearsLeft: remainingTermInMonths / 12 }),
      ...(homeValue == null ? {} : { homeValue }),
      ...(monthlyPmi == null ? {} : { currentMonthlyPmi: monthlyPmi }),
    });
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

  /**
   * Checks only the home-equity fields that are shown: none until the comparison is asked for, and a line's draw period and
   * repayment rate only for a line, so a field that is out of sight cannot hold up the comparison.
   */
  private checkEquityFieldsShown(): void {
    const v = this.form.getRawValue();
    const asked = v.cashOut > 0 && v.compareEquityLoan;
    const c = this.form.controls;
    const show = (control: AbstractControl, shown: boolean) => {
      if (shown && control.disabled) control.enable({ emitEvent: false });
      else if (!shown && control.enabled) control.disable({ emitEvent: false });
    };
    for (const control of [c.equityRate, c.equityTermYears, c.equityYearsKept]) show(control, asked);
    for (const control of [c.equityDrawYears, c.equityRepaymentRate]) show(control, asked && v.equityKind === 'line');
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
      ...(this.loanToday()?.paidOff ? [paidOffAlready()] : []),
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
    return this.byOriginalLoan() ? msg('Fixed for (payments from the first)') : msg('Next reset in (payments)');
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
      cashOut: v.cashOut,
      originalLoan: today
        ? { amount: v.originalAmount, termInMonths: Math.round(v.originalTermYears * 12), firstPaymentDate: v.firstPaymentDate }
        : null,
      currentAdjustableRate: rateOptionsRequest(this.form.controls.currentRate, 'reset').adjustableRate,
      newAdjustableRate: newRate.adjustableRate,
      newBuydown: newRate.buydown,
      homeValue: v.homeValue,
      currentMonthlyPmi: v.currentMonthlyPmi,
      newPmiRate: v.newPmiRate,
      // Only when asked for, so a comparison without one is the same request as before.
      ...(v.cashOut > 0 && v.compareEquityLoan
        ? {
          homeEquityLoan: {
            annualInterestRate: v.equityRate,
            termInMonths: Math.round(v.equityTermYears * 12),
            yearsKept: v.equityYearsKept,
            ...(v.equityKind === 'line' ? { drawPeriodInMonths: Math.round(v.equityDrawYears * 12), repaymentRate: v.equityRepaymentRate } : {}),
          },
        }
        : {}),
    };
  }
}
