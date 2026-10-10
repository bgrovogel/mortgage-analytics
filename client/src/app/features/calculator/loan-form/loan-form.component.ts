import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { problemsIn, problemsOf, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { NumberInputDirective } from '../../../core/forms/number-input.directive';
import { setChanged } from '../../../core/forms/set-changed';
import { formatMonths } from '../../../core/formatting/duration';
import { SharedLoanChange } from '../../../core/state/shared-loan.store';
import { monthOf, pct, signedPct, usd } from '../../../core/formatting/format';
import {
  AmortizationRequest,
  ExtraPaymentStrategy,
  MortgageInsuranceCancellation,
} from '../../../core/models/amortization.models';
import { LOAN_RULES, LUMP_SUM_RULES, wholeYearsOf } from './loan-fields';

type LumpSumForm = FormGroup<{ paymentNumber: FormControl<number>; amount: FormControl<number> }>;

/** Whether the down payment field holds dollars or a percentage of the price. */
export type DownPaymentMode = 'amount' | 'percent';

const rules = LOAN_RULES;

/** Shown while the down payment leaves nothing to borrow. */
export const NOTHING_TO_BORROW = 'The down payment must be less than the home price.';

/** Shown in a section's summary when one of its fields is invalid, so the problem is not hidden by collapsing. */
const CHECK_SECTION = 'Check the values in this section';

/** Controls inside each collapsible section, used to flag a closed section that holds an invalid value. */
const SECTION_CONTROLS = {
  taxes: ['schoolTaxRate', 'localTaxRate', 'mudTaxRate', 'pidAnnual', 'pidYears', 'schoolHomesteadExemption',
    'localHomesteadExemptionPercent', 'homesteadAssessmentCap', 'over65Year', 'over65SchoolExemption', 'over65LocalExemption'],
  costs: ['annualInsurance', 'monthlyHoa', 'pmiRate'],
  growth: ['homeValueGrowthRate', 'insuranceIncreaseRate', 'hoaIncreaseRate'],
  options: ['firstPaymentDate', 'annualExtra', 'annualFirstPayment', 'lumpSums', 'recastMinimum', 'recastFee'],
} as const;


/** Rounds to cents, the same way the API does. */
const cents = (value: number) => Math.round(value * 100) / 100;

/** 1 becomes "1%", 0.85 becomes "0.85%": rates here have up to four decimals. */
const percent = (value: number) => pct(value, 4);

/** 4 becomes "+4%", -2 becomes "-2%", 0 becomes "0%". */
const signedPercent = (value: number) => signedPct(value, 4);

/** Returns the first day of next month as yyyy-MM-dd, the API's default first payment date. */
function firstOfNextMonth(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

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
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe, NumberFieldComponent, NumberInputDirective],
  templateUrl: './loan-form.component.html',
  styleUrl: './loan-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** A request to start from (the last calculation, or a saved one) instead of the worked example. */
  readonly initial = input<AmortizationRequest | null>(null);

  /** A loan changed on another page since this one was last open: the form starts from it. */
  readonly loan = input<SharedLoanChange | null>(null);

  /** Where the loan was filled in from, and the years left before rounding when the term had to be rounded. */
  readonly sharedFrom = signal<{ from: string; rounded: string | null } | null>(null);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly calculate = output<AmortizationRequest>();

  /** True while a request is being loaded into the form, so its many changes do not each emit. */
  private restoring = false;

  protected readonly rules = rules;
  protected readonly lumpSumRules = LUMP_SUM_RULES;
  protected readonly nothingToBorrow = NOTHING_TO_BORROW;

  // Defaults describe a typical Texas homestead purchase with 5% down, so PMI, MUD tax, the $140,000
  // school exemption and yearly increases are all visible on load.
  readonly form = this.fb.group({
    homePrice: [375_000, validatorsFor(rules.homePrice)],
    downPaymentMode: this.fb.control<DownPaymentMode>('amount'),
    // Dollars or a percentage of the price, depending on downPaymentMode.
    downPayment: [18_750, validatorsFor(rules.downPayment)],
    annualInterestRate: [6.5, validatorsFor(rules.annualInterestRate)],
    termYears: [30, validatorsFor(rules.termYears)],
    // Optional: a blank date lets the API default to the first of next month.
    firstPaymentDate: [firstOfNextMonth()],

    schoolTaxRate: [1.0, validatorsFor(rules.schoolTaxRate)],
    localTaxRate: [1.1, validatorsFor(rules.localTaxRate)],
    mudTaxRate: [0.85, validatorsFor(rules.mudTaxRate)],
    isHomestead: [true],
    schoolHomesteadExemption: [140_000, validatorsFor(rules.schoolHomesteadExemption)],
    localHomesteadExemptionPercent: [0, validatorsFor(rules.localHomesteadExemptionPercent)],
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
    pmiCancellation: this.fb.control<MortgageInsuranceCancellation>('Automatic'),

    monthlyExtra: [200, validatorsFor(rules.monthlyExtra)],
    annualExtra: [0, validatorsFor(rules.annualExtra)],
    annualFirstPayment: [12, validatorsFor(rules.annualFirstPayment)],
    lumpSums: this.fb.array<LumpSumForm>([]),

    strategy: this.fb.control<ExtraPaymentStrategy>('ShortenTerm'),
    recastMinimum: [10_000, validatorsFor(rules.recastMinimum)],
    recastFee: [250, validatorsFor(rules.recastFee)],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

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
  readonly pmiApplies = computed(() => this.downPaymentPercent() < 20);

  readonly isRecast = computed(() => this.values().strategy === 'Recast');

  /** Homestead exemptions and the assessment cap apply only to a primary residence. */
  readonly isHomestead = computed(() => this.values().isHomestead === true);

  /** Over-65 / disability relief applies only to a homestead. */
  readonly isOver65 = computed(() => this.isHomestead() && this.values().isOver65 === true);

  /** One-line summary of the property-tax section. */
  readonly taxesSummary = computed(() => {
    const v = this.values();
    if (this.sectionInvalid('taxes')) return CHECK_SECTION;

    const parts = [
      v.schoolTaxRate ? `School ${percent(v.schoolTaxRate)}` : '',
      v.localTaxRate ? `County/city ${percent(v.localTaxRate)}` : '',
      v.mudTaxRate ? `MUD ${percent(v.mudTaxRate)}` : '',
      v.pidAnnual ? `PID ${usd(v.pidAnnual)}/yr` : '',
    ].filter(Boolean);
    if (parts.length === 0) return 'No property taxes';

    if (this.isHomestead()) parts.push('Homestead');
    if (this.isOver65()) parts.push('Over 65');
    return parts.join(' · ');
  });

  /** One-line summary of the insurance, HOA, PID and PMI section. */
  readonly costsSummary = computed(() => {
    const v = this.values();
    if (this.sectionInvalid('costs')) return CHECK_SECTION;

    const parts = [
      v.annualInsurance ? `Insurance ${usd(v.annualInsurance)}/yr` : '',
      v.monthlyHoa ? `HOA ${usd(v.monthlyHoa)}/mo` : '',
      this.pmiApplies() && v.pmiRate ? `PMI ${percent(v.pmiRate)}` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'None';
  });

  /** One-line summary of the yearly-increase assumptions. */
  readonly growthSummary = computed(() => {
    const v = this.values();
    if (this.sectionInvalid('growth')) return CHECK_SECTION;

    return `Home ${signedPercent(v.homeValueGrowthRate ?? 0)} · Insurance ${signedPercent(v.insuranceIncreaseRate ?? 0)}`
      + ` · HOA ${signedPercent(v.hoaIncreaseRate ?? 0)}`;
  });

  /** One-line summary of the first payment date, extra payments beyond monthly, and the strategy. */
  readonly optionsSummary = computed(() => {
    const v = this.values();
    if (this.sectionInvalid('options')) return CHECK_SECTION;

    const lumpSums = v.lumpSums?.length ?? 0;
    return [
      `First payment ${v.firstPaymentDate ? monthOf(v.firstPaymentDate) : 'next month'}`,
      v.annualExtra ? `${usd(v.annualExtra)} yearly` : '',
      lumpSums ? `${lumpSums} lump sum${lumpSums === 1 ? '' : 's'}` : '',
      v.strategy === 'Recast' ? `Recast (min ${usd(v.recastMinimum ?? 0)})` : 'Pay off sooner',
    ].filter(Boolean).join(' · ');
  });

  constructor() {
    // Switching between $ and % converts the value, so the down payment itself stays the same.
    this.form.controls.downPaymentMode.valueChanges.pipe(takeUntilDestroyed()).subscribe((mode) => {
      const { homePrice, downPayment } = this.form.getRawValue();
      const converted = mode === 'percent'
        ? (homePrice > 0 ? cents((downPayment / homePrice) * 100) : 0)
        : cents((homePrice * downPayment) / 100);
      this.form.controls.downPayment.setValue(converted);
    });

    // Recalculate as the user types: every change that leaves the form valid produces a request.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.restoring && this.isComplete()) this.calculate.emit(this.toRequest());
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
    this.submit();
  }

  /**
   * Fills in the loan changed on another page: the price is the home's value (or stays, when that page did not
   * ask), the down payment is what is not owed, and the term is the years left, to the nearest whole year.
   */
  private startFromSharedLoan(): void {
    const shared = this.loan();
    if (!shared) return;
    const { balance, annualInterestRate, remainingTermInMonths, homeValue } = shared.loan;
    const price = Math.max(homeValue ?? this.form.controls.homePrice.value, balance);
    const years = wholeYearsOf(remainingTermInMonths);
    const wasPercent = this.form.controls.downPaymentMode.value !== 'amount';
    this.form.controls.downPaymentMode.setValue('amount', { emitEvent: false });
    const changed = setChanged(this.form, {
      homePrice: price,
      downPayment: cents(price - balance),
      annualInterestRate,
      termYears: years,
    });
    if (changed || wasPercent) {
      this.sharedFrom.set({ from: shared.from, rounded: years * 12 === remainingTermInMonths ? null : formatMonths(remainingTermInMonths) });
    }
  }

  /** Adds a lump-sum row, pre-filled with a $10,000 payment at month 12 (enough to qualify for a typical recast). */
  addLumpSum(): void {
    this.lumpSums.push(this.lumpSumGroup(12, 10_000));
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
    if (!this.isComplete()) {
      this.form.markAllAsTouched();
      return;
    }
    this.calculate.emit(this.toRequest());
  }

  /** True when the form can be sent: every field valid and something left to borrow. */
  private isComplete(): boolean {
    const v = this.form.getRawValue();
    return this.form.valid && v.homePrice - downPaymentAmountOf(v) > 0;
  }

  /** Everything wrong with the form: each invalid number, each invalid lump sum, and nothing left to borrow. */
  private currentProblems(): string[] {
    const v = this.form.getRawValue();
    return [
      ...problemsIn(rules, this.form.controls),
      ...this.lumpSums.controls.flatMap((row) => problemsIn(LUMP_SUM_RULES, row.controls)),
      ...(this.form.controls.homePrice.valid && this.form.controls.downPayment.valid && v.homePrice - downPaymentAmountOf(v) <= 0
        ? [NOTHING_TO_BORROW] : []),
    ];
  }

  /** True when any control in `section` is invalid. */
  private sectionInvalid(section: keyof typeof SECTION_CONTROLS): boolean {
    return SECTION_CONTROLS[section].some((name) => this.form.controls[name].invalid);
  }

  /**
   * Fills the form from a request: the reverse of toRequest. The down payment comes back in dollars.
   * Parts the request leaves out (no extras, no housing costs) become zero; fields that only matter
   * when an option is on (recast terms, over-65 details) keep their defaults when it is off.
   */
  private restore(r: AmortizationRequest): void {
    const extras = r.extraPayments;
    const costs = r.housingCosts;
    const senior = costs?.over65OrDisabled;
    this.restoring = true;
    this.form.controls.downPaymentMode.setValue('amount', { emitEvent: false });
    this.lumpSums.clear({ emitEvent: false });
    for (const lump of extras?.lumpSums ?? []) {
      this.lumpSums.push(this.lumpSumGroup(lump.paymentNumber, lump.amount), { emitEvent: false });
    }
    this.form.patchValue({
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
      schoolTaxRate: costs?.schoolTaxRate ?? 0,
      localTaxRate: costs?.localTaxRate ?? 0,
      mudTaxRate: costs?.mudTaxRate ?? 0,
      isHomestead: costs?.isHomestead ?? false,
      schoolHomesteadExemption: costs?.schoolHomesteadExemption ?? 0,
      localHomesteadExemptionPercent: costs?.localHomesteadExemptionPercent ?? 0,
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
    });
    this.restoring = false;
  }

  private lumpSumGroup(paymentNumber: number, amount: number): LumpSumForm {
    return this.fb.group({
      paymentNumber: [paymentNumber, validatorsFor(LUMP_SUM_RULES.paymentNumber)],
      amount: [amount, validatorsFor(LUMP_SUM_RULES.amount)],
    });
  }

  /** Converts form values (years, flat fields) into the API's request shape. */
  private toRequest(): AmortizationRequest {
    const v = this.form.getRawValue();
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
        monthlyStartingPaymentNumber: 1,
        annual: v.annualExtra > 0 ? { amount: v.annualExtra, firstPaymentNumber: v.annualFirstPayment } : null,
        lumpSums: v.lumpSums,
      },
      housingCosts: {
        schoolTaxRate: v.schoolTaxRate || 0,
        localTaxRate: v.localTaxRate || 0,
        mudTaxRate: v.mudTaxRate || 0,
        isHomestead: v.isHomestead,
        schoolHomesteadExemption: v.schoolHomesteadExemption || 0,
        localHomesteadExemptionPercent: v.localHomesteadExemptionPercent || 0,
        homesteadAssessmentCap: v.homesteadAssessmentCap || 0,
        over65OrDisabled: v.isHomestead && v.isOver65
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
    };
  }
}

/** The down payment in dollars: as entered, or the entered percentage of the price, rounded to cents. */
function downPaymentAmountOf(v: { homePrice?: number; downPayment?: number; downPaymentMode?: DownPaymentMode }): number {
  const entered = v.downPayment ?? 0;
  return v.downPaymentMode === 'percent' ? cents(((v.homePrice ?? 0) * entered) / 100) : entered;
}
