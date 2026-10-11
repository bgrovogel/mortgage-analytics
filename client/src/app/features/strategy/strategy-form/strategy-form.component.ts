import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { problemsIn, problemsOf, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { setChanged } from '../../../core/forms/set-changed';
import { decimal, usd } from '../../../core/formatting/format';
import { InvestorRiskProfile, StrategyRequest, TaxFilingStatus } from '../../../core/models/strategy.models';
import { SharedLoanChange } from '../../../core/state/shared-loan.store';
import { IRA_LIMIT, STRATEGY_RULES } from './strategy-fields';
import { RateOptionsComponent } from '../../../shared/rate-options/rate-options.component';
import { RATE_OPTION_RULES, applySharedRate, keepArmFieldsInStep, rateOptionsForm, rateOptionsRequest, rateSummary, setRateOptions } from '../../../shared/rate-options/rate-options';

const rules = STRATEGY_RULES;


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


/**
 * Presentational: the mortgage, the household, its investment options and the market. Emits a ready-to-send
 * request on load and whenever a change leaves the form valid. The main inputs are always visible; the rest
 * sit in collapsible sections, each summarized in one line.
 */
@Component({
  selector: 'app-strategy-form',
  imports: [ReactiveFormsModule, NumberFieldComponent, RateOptionsComponent],
  templateUrl: './strategy-form.component.html',
  styleUrl: './strategy-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategyFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  /** A comparison to start from (the last one) instead of the defaults. */
  readonly initial = input<StrategyRequest | null>(null);

  /** A loan changed on another page since this one was last open: the form starts from it. */
  readonly loan = input<SharedLoanChange | null>(null);

  /** The page the loan was filled in from, when starting from the shared loan changed anything. */
  readonly sharedFrom = signal<string | null>(null);

  /** Emits a complete request on load and after every change that leaves the form valid. */
  readonly compare = output<StrategyRequest>();

  protected readonly filingStatuses = FILING_STATUSES;
  protected readonly riskProfiles = RISK_PROFILES;
  protected readonly rules = rules;

  readonly form = this.fb.group({
    currentBalance: [300_000, validatorsFor(rules.currentBalance)],
    annualInterestRate: [6.5, validatorsFor(rules.annualInterestRate)],
    // Years, so people can answer from memory; sent as months.
    yearsLeft: [25, validatorsFor(rules.yearsLeft)],
    homeValue: [400_000, validatorsFor(rules.homeValue)],
    monthlyCashToPutToWork: [1_000, validatorsFor(rules.monthlyCashToPutToWork)],
    riskProfile: this.fb.control<InvestorRiskProfile>('Balanced'),

    grossAnnualIncome: [120_000, validatorsFor(rules.grossAnnualIncome)],
    marginalTaxRate: [24, validatorsFor(rules.marginalTaxRate)],
    filingStatus: this.fb.control<TaxFilingStatus>('MarriedFilingJointly'),
    otherItemizedDeductions: [10_000, validatorsFor(rules.otherItemizedDeductions)],
    capitalGainsTaxRate: [15, validatorsFor(rules.capitalGainsTaxRate)],

    employerMatchPercent: [50, validatorsFor(rules.employerMatchPercent)],
    matchUpToPercentOfPay: [6, validatorsFor(rules.matchUpToPercentOfPay)],
    annualIraContribution: [IRA_LIMIT, validatorsFor(rules.annualIraContribution)],
    currentRetirementSavings: [50_000, validatorsFor(rules.currentRetirementSavings)],
    currentInvestments: [20_000, validatorsFor(rules.currentInvestments)],

    annualRsuVesting: [0, validatorsFor(rules.annualRsuVesting)],
    sellRsusAtVest: [false],
    annualEsopContribution: [0, validatorsFor(rules.annualEsopContribution)],
    esppContributionPercent: [0, validatorsFor(rules.esppContributionPercent)],
    esppDiscountPercent: [15, validatorsFor(rules.esppDiscountPercent)],
    esppPurchasePeriodMonths: [6, validatorsFor(rules.esppPurchasePeriodMonths)],

    // Long-run averages: the S&P 500 has returned about 10% a year with dividends since 1926; inflation about 3%.
    expectedAnnualReturn: [10, validatorsFor(rules.expectedAnnualReturn)],
    inflationRate: [3, validatorsFor(rules.inflationRate)],
    homeGrowthRate: [4.3, validatorsFor(rules.homeGrowthRate)],

    // Fixed; a buydown on a new loan; or adjustable, its next reset 60 payments away, expected a point higher.
    rate: rateOptionsForm(this.fb, 7.5, 60),
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /**
   * Emits what is wrong whenever that changes: an empty list once every field is valid again. While a field
   * is invalid no request is sent, so the page can say its results are for the last valid inputs.
   */
  readonly problems = outputFromObservable(problemsOf(this.form, () => [
    ...problemsIn(rules, this.form.controls),
    ...problemsIn(RATE_OPTION_RULES, this.form.controls.rate.controls),
  ]));

  /** One line for the closed rate section. */
  readonly rateSummary = computed(() => {
    const v = this.values();
    return rateSummary(this.form.controls.rate, 'reset', v.annualInterestRate ?? 0);
  });

  /** The risk-adjusted return for the chosen profile, shown beside the picker. */
  readonly countingOn = computed(() => {
    const v = this.values();
    const margin = RISK_PROFILES.find((p) => p.value === v.riskProfile)?.margin ?? 0;
    return `${decimal((v.expectedAnnualReturn ?? 0) - margin)}%`;
  });

  readonly taxesSummary = computed(() => {
    const v = this.values();
    const status = FILING_STATUSES.find((s) => s.value === v.filingStatus)?.label ?? '';
    return `${usd(v.grossAnnualIncome ?? 0)} · ${decimal(v.marginalTaxRate ?? 0)}% · ${status}`;
  });

  readonly savingsSummary = computed(() => {
    const v = this.values();
    const match = (v.employerMatchPercent ?? 0) > 0 && (v.matchUpToPercentOfPay ?? 0) > 0
      ? `${decimal(v.employerMatchPercent ?? 0)}% match on ${decimal(v.matchUpToPercentOfPay ?? 0)}% of pay`
      : 'No match';
    return `${match} · IRA ${usd(v.annualIraContribution ?? 0)}/yr`;
  });

  readonly stockSummary = computed(() => {
    const v = this.values();
    const parts = [
      (v.annualRsuVesting ?? 0) > 0 ? `RSUs ${usd(v.annualRsuVesting ?? 0)}/yr` : '',
      (v.annualEsopContribution ?? 0) > 0 ? `ESOP ${usd(v.annualEsopContribution ?? 0)}/yr` : '',
      (v.esppContributionPercent ?? 0) > 0 ? `ESPP ${decimal(v.esppContributionPercent ?? 0)}% of pay` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'None';
  });

  readonly marketSummary = computed(() => {
    const v = this.values();
    return `Stocks ${decimal(v.expectedAnnualReturn ?? 0)}% · Inflation ${decimal(v.inflationRate ?? 0)}% · Home ${decimal(v.homeGrowthRate ?? 0)}%`;
  });

  constructor() {
    keepArmFieldsInStep(this.form.controls.rate);
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.form.valid) this.compare.emit(this.toRequest());
    });
  }

  /** Loads the starting request, if any, then compares at once. */
  ngOnInit(): void {
    const initial = this.initial();
    if (initial) {
      const { remainingTermInMonths, nextPaymentDate: _date, adjustableRate, buydown, ...rest } = initial;
      this.form.patchValue({ ...rest, yearsLeft: remainingTermInMonths / 12 }, { emitEvent: false });
      setRateOptions(this.form.controls.rate, buydown, adjustableRate);
    }
    const shared = this.loan();
    if (shared) {
      const { balance, annualInterestRate, remainingTermInMonths, homeValue } = shared.loan;
      const changed = setChanged(this.form, {
        currentBalance: balance,
        annualInterestRate,
        yearsLeft: remainingTermInMonths / 12,
        ...(homeValue === null ? {} : { homeValue }),
      });
      const rateChanged = applySharedRate(this.form.controls.rate, shared.loan.rate);
      if (changed || rateChanged) this.sharedFrom.set(shared.from);
    }
    if (this.form.valid) this.compare.emit(this.toRequest());
  }

  private toRequest(): StrategyRequest {
    const { yearsLeft, rate: _rate, ...rest } = this.form.getRawValue();
    return { ...rest, remainingTermInMonths: Math.round(yearsLeft * 12), nextPaymentDate: null, ...rateOptionsRequest(this.form.controls.rate, 'reset') };
  }
}
