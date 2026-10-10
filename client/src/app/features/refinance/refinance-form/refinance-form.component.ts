import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NumberInputDirective } from '../../../core/forms/number-input.directive';
import { RefinanceRequest } from '../../../core/models/refinance.models';

/** The usual new terms, in years. "keep" means the new loan ends when the current one would. */
const TERMS = [30, 25, 20, 15, 10] as const;
type NewTerm = `${(typeof TERMS)[number]}` | 'keep';

/** Limits mirror the server's validator. The server re-validates everything regardless. */
const MAX_RATE = 30;
const MAX_YEARS = 50;

/**
 * Presentational: the loan today and the refinance offer. Emits a ready-to-send request on load and
 * whenever a change leaves the form valid; the page sends it. The defaults are a worked example in which
 * the payment drops but the total cost rises, because the 30-year clock starts over.
 */
@Component({
  selector: 'app-refinance-form',
  imports: [ReactiveFormsModule, NumberInputDirective],
  templateUrl: './refinance-form.component.html',
  styleUrl: './refinance-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefinanceFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** A comparison to start from (the last one) instead of the worked example. */
  readonly initial = input<RefinanceRequest | null>(null);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly analyze = output<RefinanceRequest>();

  protected readonly terms = TERMS;

  readonly form = this.fb.group({
    currentBalance: [300_000, [Validators.required, Validators.min(0.01)]],
    currentAnnualInterestRate: [7, [Validators.required, Validators.min(0), Validators.max(MAX_RATE)]],
    // Years, so people can answer from memory ("about 25 years left"); sent as months.
    yearsLeft: [25, [Validators.required, Validators.min(1 / 12), Validators.max(MAX_YEARS)]],
    newAnnualInterestRate: [6, [Validators.required, Validators.min(0), Validators.max(MAX_RATE)]],
    newTerm: this.fb.control<NewTerm>('30'),
    closingCosts: [6_000, [Validators.required, Validators.min(0)]],
    financeClosingCosts: [false],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Payments left on the current loan. */
  readonly remainingMonths = computed(() => Math.round((this.values().yearsLeft ?? 0) * 12));

  /** "25 years", or "22 yr 6 mo" for part years, for the keep-my-payoff-date option. */
  readonly remainingLabel = computed(() => {
    const months = this.remainingMonths();
    return months % 12 === 0 ? `${months / 12} years` : `${Math.floor(months / 12)} yr ${months % 12} mo`;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.valid) this.analyze.emit(this.toRequest());
    });
  }

  /** Loads the starting request, if any, then compares at once. */
  ngOnInit(): void {
    const initial = this.initial();
    if (initial) {
      this.form.setValue(
        {
          currentBalance: initial.currentBalance,
          currentAnnualInterestRate: initial.currentAnnualInterestRate,
          yearsLeft: initial.remainingTermInMonths / 12,
          newAnnualInterestRate: initial.newAnnualInterestRate,
          newTerm: initial.newTermInMonths === initial.remainingTermInMonths ? 'keep' : (`${initial.newTermInMonths / 12}` as NewTerm),
          closingCosts: initial.closingCosts,
          financeClosingCosts: initial.financeClosingCosts,
        },
        { emitEvent: false },
      );
    }
    if (this.form.valid) this.analyze.emit(this.toRequest());
  }

  /** True when a control should show its error: invalid and already interacted with. */
  showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  private toRequest(): RefinanceRequest {
    const v = this.form.getRawValue();
    const remaining = Math.round(v.yearsLeft * 12);
    return {
      currentBalance: v.currentBalance,
      currentAnnualInterestRate: v.currentAnnualInterestRate,
      remainingTermInMonths: remaining,
      nextPaymentDate: null,
      newAnnualInterestRate: v.newAnnualInterestRate,
      newTermInMonths: v.newTerm === 'keep' ? remaining : Number(v.newTerm) * 12,
      closingCosts: v.closingCosts,
      financeClosingCosts: v.financeClosingCosts,
    };
  }
}
