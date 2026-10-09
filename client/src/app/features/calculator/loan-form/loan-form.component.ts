import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AmortizationRequest,
  ExtraPaymentStrategy,
  MortgageInsuranceCancellation,
} from '../../../core/models/amortization.models';

type LumpSumForm = FormGroup<{ paymentNumber: FormControl<number>; amount: FormControl<number> }>;

/** Limits mirror the server's validator. The server re-validates everything regardless. */
const MAX_YEARS = 50;
const MAX_RATE = 30;

/** Returns the first day of next month as yyyy-MM-dd, the API's default first payment date. */
function firstOfNextMonth(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Presentational component: owns the form and emits a ready-to-send request.
 * It knows nothing about HTTP; the page decides what to do with the request.
 */
@Component({
  selector: 'app-loan-form',
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './loan-form.component.html',
  styleUrl: './loan-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** True while a calculation is in flight; disables the submit button. */
  readonly busy = input(false);

  /** Emits a complete request each time the form is submitted while valid. */
  readonly calculate = output<AmortizationRequest>();

  readonly maxYears = MAX_YEARS;

  // Defaults describe a typical Texas homestead purchase with 5% down, so PMI, MUD tax, the $140,000
  // school exemption and yearly increases are all visible on load.
  readonly form = this.fb.group({
    homePrice: [375_000, [Validators.required, Validators.min(1)]],
    downPayment: [18_750, [Validators.required, Validators.min(0)]],
    annualInterestRate: [6.5, [Validators.required, Validators.min(0), Validators.max(MAX_RATE)]],
    termYears: [30, [Validators.required, Validators.min(1), Validators.max(MAX_YEARS)]],
    firstPaymentDate: [firstOfNextMonth(), Validators.required],

    schoolTaxRate: [1.0, [Validators.min(0), Validators.max(10)]],
    propertyTaxRate: [1.1, [Validators.min(0), Validators.max(10)]],
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
    recastMinimum: [10_000, [Validators.min(0)]],
    recastFee: [250, [Validators.min(0)]],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Loan amount derived live from price and down payment, shown under the down payment field. */
  readonly loanAmount = computed(() => Math.max(0, (this.values().homePrice ?? 0) - (this.values().downPayment ?? 0)));

  /** Down payment as a percentage of the price. */
  readonly downPaymentPercent = computed(() => {
    const price = this.values().homePrice ?? 0;
    return price > 0 ? ((this.values().downPayment ?? 0) / price) * 100 : 0;
  });

  /** PMI applies only with less than 20% down. */
  readonly pmiApplies = computed(() => this.downPaymentPercent() < 20);

  readonly isRecast = computed(() => this.values().strategy === 'Recast');

  /** Homestead exemptions and the assessment cap apply only to a primary residence. */
  readonly isHomestead = computed(() => this.values().isHomestead === true);

  /** Over-65 / disability relief applies only to a homestead. */
  readonly isOver65 = computed(() => this.isHomestead() && this.values().isOver65 === true);

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
    if (this.form.invalid || this.loanAmount() <= 0) {
      this.form.markAllAsTouched();
      return;
    }
    this.calculate.emit(this.toRequest());
  }

  /** Converts form values (years, flat fields) into the API's request shape. */
  private toRequest(): AmortizationRequest {
    const v = this.form.getRawValue();
    return {
      homePrice: v.homePrice,
      downPayment: v.downPayment,
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
        propertyTaxRate: v.propertyTaxRate || 0,
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
