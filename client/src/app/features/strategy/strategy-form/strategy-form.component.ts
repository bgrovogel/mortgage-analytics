import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NumberInputDirective } from '../../../core/forms/number-input.directive';
import { InvestorRiskProfile, StrategyRequest, TaxFilingStatus } from '../../../core/models/strategy.models';
import { IRA_LIMIT, NUMBER_FIELDS, NumberField, problemWith, validatorsFor } from './strategy-fields';


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

  /**
   * Emits what is wrong whenever that changes: an empty list once every field is valid again. While a field
   * is invalid no request is sent, so the page can say its results are for the last valid inputs.
   */
  readonly problems = output<string[]>();

  protected readonly filingStatuses = FILING_STATUSES;
  protected readonly riskProfiles = RISK_PROFILES;

  readonly form = this.fb.group({
    currentBalance: [300_000, validatorsFor('currentBalance')],
    annualInterestRate: [6.5, validatorsFor('annualInterestRate')],
    // Years, so people can answer from memory; sent as months.
    yearsLeft: [25, validatorsFor('yearsLeft')],
    homeValue: [400_000, validatorsFor('homeValue')],
    monthlyCashToPutToWork: [1_000, validatorsFor('monthlyCashToPutToWork')],
    riskProfile: this.fb.control<InvestorRiskProfile>('Balanced'),

    grossAnnualIncome: [120_000, validatorsFor('grossAnnualIncome')],
    marginalTaxRate: [24, validatorsFor('marginalTaxRate')],
    filingStatus: this.fb.control<TaxFilingStatus>('MarriedFilingJointly'),
    otherItemizedDeductions: [10_000, validatorsFor('otherItemizedDeductions')],
    capitalGainsTaxRate: [15, validatorsFor('capitalGainsTaxRate')],

    employerMatchPercent: [50, validatorsFor('employerMatchPercent')],
    matchUpToPercentOfPay: [6, validatorsFor('matchUpToPercentOfPay')],
    annualIraContribution: [IRA_LIMIT, validatorsFor('annualIraContribution')],
    currentRetirementSavings: [50_000, validatorsFor('currentRetirementSavings')],
    currentInvestments: [20_000, validatorsFor('currentInvestments')],

    annualRsuVesting: [0, validatorsFor('annualRsuVesting')],
    sellRsusAtVest: [false],
    annualEsopContribution: [0, validatorsFor('annualEsopContribution')],
    esppContributionPercent: [0, validatorsFor('esppContributionPercent')],
    esppDiscountPercent: [15, validatorsFor('esppDiscountPercent')],
    esppPurchasePeriodMonths: [6, validatorsFor('esppPurchasePeriodMonths')],

    // Long-run averages: the S&P 500 has returned about 10% a year with dividends since 1926; inflation about 3%.
    expectedAnnualReturn: [10, validatorsFor('expectedAnnualReturn')],
    inflationRate: [3, validatorsFor('inflationRate')],
    homeGrowthRate: [4.3, validatorsFor('homeGrowthRate')],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Everything wrong with the form right now, one line per field, in the form's order. */
  readonly allProblems = computed(() => {
    this.values(); // re-read on every change
    return (Object.keys(NUMBER_FIELDS) as NumberField[])
      .map((field) => problemWith(field, this.form.controls[field]))
      .filter((problem): problem is string => problem !== null);
  });

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
    let reported = '';
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.valid) this.compare.emit(this.toRequest());
      const problems = this.allProblems();
      if (problems.join('\n') !== reported) {
        reported = problems.join('\n');
        this.problems.emit(problems);
      }
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

  /** True when a field should show its error: invalid and already interacted with. */
  showError(field: NumberField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  /** What is wrong with a field, in plain words. */
  message(field: NumberField): string {
    return problemWith(field, this.form.controls[field]) ?? '';
  }

  private toRequest(): StrategyRequest {
    const { yearsLeft, ...rest } = this.form.getRawValue();
    return { ...rest, remainingTermInMonths: Math.round(yearsLeft * 12), nextPaymentDate: null };
  }
}
