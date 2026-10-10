import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NumberInputDirective } from '../../../core/forms/number-input.directive';
import {
  AmortizationRequest,
  ExtraPaymentStrategy,
  MortgageInsuranceCancellation,
} from '../../../core/models/amortization.models';

type LumpSumForm = FormGroup<{ paymentNumber: FormControl<number>; amount: FormControl<number> }>;

/** Whether the down payment field holds dollars or a percentage of the price. */
export type DownPaymentMode = 'amount' | 'percent';

/** Limits mirror the server's validator. The server re-validates everything regardless. */
const MAX_YEARS = 50;
const MAX_RATE = 30;
const MIN_RECAST_LUMP_SUM = 1_000;

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

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Rounds to cents, the same way the API does. */
const cents = (value: number) => Math.round(value * 100) / 100;

/** 1 becomes "1%", 0.85 becomes "0.85%". */
const percent = (value: number) => `${Number(value.toFixed(4))}%`;

/** 4 becomes "+4%", -2 becomes "-2%", 0 becomes "0%". */
const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${percent(value)}`;

/** Returns the first day of next month as yyyy-MM-dd, the API's default first payment date. */
function firstOfNextMonth(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Presentational component: owns the form and emits a ready-to-send request whenever a change
 * leaves it valid, so results update as the user types. It knows nothing about HTTP or timing;
 * the page debounces and sends the requests.
 *
 * Only the five main fields are always visible. Everything else lives in collapsible sections,
 * each summarized in one line while closed.
 */
@Component({
  selector: 'app-loan-form',
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe, NumberInputDirective],
  templateUrl: './loan-form.component.html',
  styleUrl: './loan-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly calculate = output<AmortizationRequest>();

  readonly maxYears = MAX_YEARS;

  // Defaults describe a typical Texas homestead purchase with 5% down, so PMI, MUD tax, the $140,000
  // school exemption and yearly increases are all visible on load.
  readonly form = this.fb.group({
    homePrice: [375_000, [Validators.required, Validators.min(1)]],
    downPaymentMode: this.fb.control<DownPaymentMode>('amount'),
    // Dollars or a percentage of the price, depending on downPaymentMode.
    downPayment: [18_750, [Validators.required, Validators.min(0)]],
    annualInterestRate: [6.5, [Validators.required, Validators.min(0), Validators.max(MAX_RATE)]],
    termYears: [30, [Validators.required, Validators.min(1), Validators.max(MAX_YEARS)]],
    // Optional: a blank date lets the API default to the first of next month.
    firstPaymentDate: [firstOfNextMonth()],

    schoolTaxRate: [1.0, [Validators.min(0), Validators.max(10)]],
    localTaxRate: [1.1, [Validators.min(0), Validators.max(10)]],
    mudTaxRate: [0.85, [Validators.min(0), Validators.max(5)]],
    isHomestead: [true],
    schoolHomesteadExemption: [140_000, [Validators.min(0)]],
    localHomesteadExemptionPercent: [0, [Validators.min(0), Validators.max(100)]],
    homesteadAssessmentCap: [10, [Validators.min(0), Validators.max(100)]],
    isOver65: [false],
    over65Year: [1, [Validators.min(1), Validators.max(MAX_YEARS)]],
    over65SchoolExemption: [60_000, [Validators.min(0)]],
    over65LocalExemption: [0, [Validators.min(0)]],
    over65LocalCeiling: [false],
    homeValueGrowthRate: [4, [Validators.min(-20), Validators.max(25)]],
    insuranceIncreaseRate: [5, [Validators.min(-20), Validators.max(50)]],
    hoaIncreaseRate: [3, [Validators.min(-20), Validators.max(50)]],
    pidAnnual: [0, [Validators.min(0)]],
    pidYears: [null as number | null, [Validators.min(1), Validators.max(50)]],
    annualInsurance: [2_400, [Validators.min(0)]],
    monthlyHoa: [50, [Validators.min(0)]],
    pmiRate: [0.5, [Validators.min(0), Validators.max(5)]],
    pmiCancellation: this.fb.control<MortgageInsuranceCancellation>('Automatic'),

    monthlyExtra: [200, [Validators.min(0)]],
    annualExtra: [0, [Validators.min(0)]],
    annualFirstPayment: [12, [Validators.min(1)]],
    lumpSums: this.fb.array<LumpSumForm>([]),

    strategy: this.fb.control<ExtraPaymentStrategy>('ShortenTerm'),
    recastMinimum: [10_000, [Validators.min(MIN_RECAST_LUMP_SUM)]],
    recastFee: [250, [Validators.min(0)]],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

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
      v.pidAnnual ? `PID ${dollars.format(v.pidAnnual)}/yr` : '',
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
      v.annualInsurance ? `Insurance ${dollars.format(v.annualInsurance)}/yr` : '',
      v.monthlyHoa ? `HOA ${dollars.format(v.monthlyHoa)}/mo` : '',
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
      `First payment ${v.firstPaymentDate ? monthYear.format(new Date(`${v.firstPaymentDate}T00:00:00Z`)) : 'next month'}`,
      v.annualExtra ? `${dollars.format(v.annualExtra)} yearly` : '',
      lumpSums ? `${lumpSums} lump sum${lumpSums === 1 ? '' : 's'}` : '',
      v.strategy === 'Recast' ? `Recast (min ${dollars.format(v.recastMinimum ?? 0)})` : 'Pay off sooner',
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
      if (this.isComplete()) this.calculate.emit(this.toRequest());
    });
  }

  /** The lump-sum rows, typed for the template. */
  get lumpSums(): FormArray<LumpSumForm> {
    return this.form.controls.lumpSums;
  }

  /** Calculates a worked example as soon as the page loads. */
  ngOnInit(): void {
    this.submit();
  }

  /** Adds a lump-sum row, pre-filled with a $10,000 payment at month 12 (enough to qualify for a typical recast). */
  addLumpSum(): void {
    this.lumpSums.push(
      this.fb.group({
        paymentNumber: [12, [Validators.required, Validators.min(1)]],
        amount: [10_000, [Validators.required, Validators.min(0.01)]],
      }),
    );
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

  /** True when any control in `section` is invalid. */
  private sectionInvalid(section: keyof typeof SECTION_CONTROLS): boolean {
    return SECTION_CONTROLS[section].some((name) => this.form.controls[name].invalid);
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
