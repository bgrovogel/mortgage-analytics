import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NumberInputDirective } from '../../../core/forms/number-input.directive';
import { InvestorRiskProfile, StrategyRequest, TaxFilingStatus } from '../../../core/models/strategy.models';

/** Limits mirror the server's validator. The server re-validates everything regardless. */
const MAX_YEARS = 30;
const IRA_LIMIT = 7_500;

export const FILING_STATUSES: readonly { value: TaxFilingStatus; label: string }[] = [
  { value: 'MarriedFilingJointly', label: 'Married filing jointly' },
  { value: 'Single', label: 'Single' },
  { value: 'HeadOfHousehold', label: 'Head of household' },
];

export const RISK_PROFILES: readonly { value: InvestorRiskProfile; label: string; margin: number }[] = [
  { value: 'Conservative', label: 'Conservative', margin: 4 },
  { value: 'Balanced', label: 'Balanced', margin: 2 },
  { value: 'Aggressive', label: 'Aggressive', margin: 0 },
];

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Presentational: the mortgage, the household, its investment options and the market. Emits a ready-to-send
 * request on load and whenever a change leaves the form valid. The main inputs are always visible; the rest
 * sit in collapsible sections, each summarized in one line.
 */
@Component({
  selector: 'app-strategy-form',
  imports: [ReactiveFormsModule, NumberInputDirective, CurrencyPipe],
  templateUrl: './strategy-form.component.html',
  styleUrl: './strategy-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategyFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** A comparison to start from (the last one) instead of the defaults. */
  readonly initial = input<StrategyRequest | null>(null);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly compare = output<StrategyRequest>();

  protected readonly filingStatuses = FILING_STATUSES;
  protected readonly riskProfiles = RISK_PROFILES;
  protected readonly iraLimit = IRA_LIMIT;

  readonly form = this.fb.group({
    currentBalance: [300_000, [Validators.required, Validators.min(0.01)]],
    annualInterestRate: [6.5, [Validators.required, Validators.min(0), Validators.max(30)]],
    // Years, so people can answer from memory; sent as months.
    yearsLeft: [25, [Validators.required, Validators.min(1 / 12), Validators.max(MAX_YEARS)]],
    homeValue: [400_000, [Validators.required, Validators.min(0)]],
    monthlyCashToPutToWork: [1_000, [Validators.required, Validators.min(0)]],
    riskProfile: this.fb.control<InvestorRiskProfile>('Balanced'),

    grossAnnualIncome: [120_000, [Validators.required, Validators.min(0)]],
    marginalTaxRate: [24, [Validators.required, Validators.min(0), Validators.max(60)]],
    filingStatus: this.fb.control<TaxFilingStatus>('MarriedFilingJointly'),
    otherItemizedDeductions: [10_000, [Validators.required, Validators.min(0)]],
    capitalGainsTaxRate: [15, [Validators.required, Validators.min(0), Validators.max(60)]],

    employerMatchPercent: [50, [Validators.required, Validators.min(0), Validators.max(200)]],
    matchUpToPercentOfPay: [6, [Validators.required, Validators.min(0), Validators.max(100)]],
    annualIraContribution: [IRA_LIMIT, [Validators.required, Validators.min(0), Validators.max(IRA_LIMIT)]],
    currentRetirementSavings: [50_000, [Validators.required, Validators.min(0)]],
    currentInvestments: [20_000, [Validators.required, Validators.min(0)]],

    annualRsuVesting: [0, [Validators.required, Validators.min(0)]],
    sellRsusAtVest: [false],
    annualEsopContribution: [0, [Validators.required, Validators.min(0)]],
    esppContributionPercent: [0, [Validators.required, Validators.min(0), Validators.max(25)]],
    esppDiscountPercent: [15, [Validators.required, Validators.min(0), Validators.max(15)]],
    esppPurchasePeriodMonths: [6, [Validators.required, Validators.min(1), Validators.max(27)]],

    // Long-run averages: the S&P 500 has returned about 10% a year with dividends since 1926; inflation about 3%.
    expectedAnnualReturn: [10, [Validators.required, Validators.min(-10), Validators.max(30)]],
    inflationRate: [3, [Validators.required, Validators.min(-5), Validators.max(20)]],
    homeGrowthRate: [4.3, [Validators.required, Validators.min(-20), Validators.max(25)]],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** The risk-adjusted return for the chosen profile, shown beside the picker. */
  readonly countingOn = computed(() => {
    const v = this.values();
    const margin = RISK_PROFILES.find((p) => p.value === v.riskProfile)?.margin ?? 0;
    return `${plain.format((v.expectedAnnualReturn ?? 0) - margin)}%`;
  });

  readonly taxesSummary = computed(() => {
    const v = this.values();
    const status = FILING_STATUSES.find((s) => s.value === v.filingStatus)?.label ?? '';
    return `${usd.format(v.grossAnnualIncome ?? 0)} · ${plain.format(v.marginalTaxRate ?? 0)}% · ${status}`;
  });

  readonly savingsSummary = computed(() => {
    const v = this.values();
    const match = (v.employerMatchPercent ?? 0) > 0 && (v.matchUpToPercentOfPay ?? 0) > 0
      ? `${plain.format(v.employerMatchPercent ?? 0)}% match on ${plain.format(v.matchUpToPercentOfPay ?? 0)}% of pay`
      : 'No match';
    return `${match} · IRA ${usd.format(v.annualIraContribution ?? 0)}/yr`;
  });

  readonly stockSummary = computed(() => {
    const v = this.values();
    const parts = [
      (v.annualRsuVesting ?? 0) > 0 ? `RSUs ${usd.format(v.annualRsuVesting ?? 0)}/yr` : '',
      (v.annualEsopContribution ?? 0) > 0 ? `ESOP ${usd.format(v.annualEsopContribution ?? 0)}/yr` : '',
      (v.esppContributionPercent ?? 0) > 0 ? `ESPP ${plain.format(v.esppContributionPercent ?? 0)}% of pay` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'None';
  });

  readonly marketSummary = computed(() => {
    const v = this.values();
    return `Stocks ${plain.format(v.expectedAnnualReturn ?? 0)}% · Inflation ${plain.format(v.inflationRate ?? 0)}% · Home ${plain.format(v.homeGrowthRate ?? 0)}%`;
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.valid) this.compare.emit(this.toRequest());
    });
  }

  /** Loads the starting request, if any, then compares at once. */
  ngOnInit(): void {
    const initial = this.initial();
    if (initial) {
      const { remainingTermInMonths, nextPaymentDate: _date, ...rest } = initial;
      this.form.setValue({ ...rest, yearsLeft: remainingTermInMonths / 12 }, { emitEvent: false });
    }
    if (this.form.valid) this.compare.emit(this.toRequest());
  }

  /** True when a control should show its error: invalid and already interacted with. */
  showError(control: FormControl<unknown>): boolean {
    return control.invalid && (control.touched || control.dirty);
  }

  private toRequest(): StrategyRequest {
    const { yearsLeft, ...rest } = this.form.getRawValue();
    return { ...rest, remainingTermInMonths: Math.round(yearsLeft * 12), nextPaymentDate: null };
  }
}
