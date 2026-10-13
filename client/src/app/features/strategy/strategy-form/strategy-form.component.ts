import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, Signal, computed, inject, input, output, signal } from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { exampleUntilEdited } from '../../../core/forms/example-until-edited';
import { problemsIn, problemsOf, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { setChanged } from '../../../core/forms/set-changed';
import { decimal, usd } from '../../../core/formatting/format';
import { InvestorRiskProfile, StrategyRequest, TaxFilingStatus } from '../../../core/models/strategy.models';
import { SharedLoanChange } from '../../../core/state/shared-loan.store';
import { EMPLOYEE_DEFERRAL_LIMIT, IRA_LIMIT, STRATEGY_RULES } from './strategy-fields';
import { TaxSituation, federalBracket, longTermGainsRate } from './tax-brackets';
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

  private readonly destroyRef = inject(DestroyRef);

  /** True while the form shows its worked example, until the visitor's first edit (see exampleUntilEdited). */
  protected example: Signal<boolean> = signal(false);

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
    monthlyPmi: [0, validatorsFor(rules.monthlyPmi)],
    monthlyCashToPutToWork: [1_000, validatorsFor(rules.monthlyCashToPutToWork)],
    riskProfile: this.fb.control<InvestorRiskProfile>('Balanced'),

    // $120,000 jointly is the 12% federal bracket for 2026; with a 5% state, 17%. Gains: 15% federal, 20% with the
    // state. Other deductions: about $5,600 of state income tax, $6,400 of property tax and $2,000 to charity.
    grossAnnualIncome: [120_000, validatorsFor(rules.grossAnnualIncome)],
    marginalTaxRate: [17, validatorsFor(rules.marginalTaxRate)],
    filingStatus: this.fb.control<TaxFilingStatus>('MarriedFilingJointly'),
    otherItemizedDeductions: [14_000, validatorsFor(rules.otherItemizedDeductions)],
    capitalGainsTaxRate: [20, validatorsFor(rules.capitalGainsTaxRate)],

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
  readonly problems = outputFromObservable(problemsOf(this.form, () => this.currentProblems()));

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

  /**
   * The 2026 federal bracket and long-term gains rate for the income, filing status and deductions entered, so the
   * tax rates typed beside them can be checked: the form adds the state's rate to them.
   */
  readonly federalRates = computed(() => {
    const v = this.values();
    const income = v.grossAnnualIncome ?? 0;
    const situation: TaxSituation = {
      income,
      status: v.filingStatus ?? 'MarriedFilingJointly',
      // The 401(k) contribution that earns the whole match, as the comparison makes it, comes off before tax.
      pretaxSavings: (v.employerMatchPercent ?? 0) > 0 ? Math.min((income * (v.matchUpToPercentOfPay ?? 0)) / 100, EMPLOYEE_DEFERRAL_LIMIT) : 0,
      otherDeductions: v.otherItemizedDeductions ?? 0,
      yearOneInterest: ((v.currentBalance ?? 0) * (v.annualInterestRate ?? 0)) / 100,
    };
    const bracket = federalBracket(situation);
    const gains = longTermGainsRate(situation);
    return {
      bracket: bracket.rate, taxable: usd(bracket.taxableIncome), gains: decimal(gains), withNiit: gains % 5 !== 0,
      // Rates that can't be right: below the federal rate alone, before any state tax.
      taxTooLow: (v.marginalTaxRate ?? 0) < bracket.rate ? decimal(v.marginalTaxRate ?? 0) : null,
      gainsTooLow: (v.capitalGainsTaxRate ?? 0) < gains ? decimal(v.capitalGainsTaxRate ?? 0) : null,
    };
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
      if (this.canSend()) this.compare.emit(this.toRequest());
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
      const { balance, annualInterestRate, remainingTermInMonths, homeValue, monthlyPmi } = shared.loan;
      const changed = setChanged(this.form, {
        currentBalance: balance,
        annualInterestRate,
        yearsLeft: remainingTermInMonths / 12,
        ...(homeValue === null ? {} : { homeValue }),
        ...(monthlyPmi == null ? {} : { monthlyPmi }),
      });
      const rateChanged = applySharedRate(this.form.controls.rate, shared.loan.rate);
      if (changed || rateChanged) this.sharedFrom.set(shared.from);
    }
    this.example = exampleUntilEdited(this.form, !initial && !this.sharedFrom(), this.destroyRef);
    if (this.canSend()) this.compare.emit(this.toRequest());
  }

  /** Everything wrong with the form: each invalid number. */
  private currentProblems(): string[] {
    return [
      ...problemsIn(rules, this.form.controls),
      ...problemsIn(RATE_OPTION_RULES, this.form.controls.rate.controls),
    ];
  }

  /** True when the form can be sent: nothing wrong with it. */
  private canSend(): boolean {
    return this.currentProblems().length === 0;
  }

  private toRequest(): StrategyRequest {
    const { yearsLeft, rate: _rate, ...rest } = this.form.getRawValue();
    return { ...rest, remainingTermInMonths: Math.round(yearsLeft * 12), nextPaymentDate: null, ...rateOptionsRequest(this.form.controls.rate, 'reset') };
  }
}
