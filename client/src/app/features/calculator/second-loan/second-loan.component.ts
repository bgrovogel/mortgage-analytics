import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { FieldRules, validatorsFor } from '../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../core/forms/number-field.component';
import { decimal, usd } from '../../../core/formatting/format';
import { SecondLoanComparison, SecondLoanInput } from '../../../core/models/amortization.models';
import { TPipe } from '../../../core/i18n/t.pipe';
import { t, tp } from '../../../core/i18n/i18n';

/** The second loan, with the limits the API enforces (AmortizationRequestValidator). */
const SECOND_LOAN_RULES = {
  amount: { get label() { return t('Second loan'); }, unit: '$', min: 0.01, max: 100_000_000 },
  annualInterestRate: { get label() { return t('Its rate'); }, unit: '%', min: 0, max: 30, decimals: 3 },
  termYears: { get label() { return t('Its term'); }, unit: 'years', min: 1, max: 30, whole: true },
  yearsKept: { get label() { return t('Years you keep the loans'); }, unit: 'years', min: 1, max: 30, whole: true },
} as const satisfies FieldRules;

/**
 * A second loan instead of PMI: the loan as made against a smaller first loan and a second behind it (an 80/10/10),
 * side by side, with what each costs over the years the loans are kept, the cheaper marked. Until one is tried, it offers
 * the usual one: the second loan that brings the first to 80% of the price, which is what removes PMI.
 */
@Component({
  selector: 'app-second-loan',
  imports: [NumberFieldComponent, TPipe],
  template: `
    @if (!comparison()) {
      <p class="intro" data-testid="second-loan-intro">
        {{ 'With less than 20% down, a conventional loan carries PMI. Another way is a smaller first loan, at 80% of the price, and a second loan for the rest of what is borrowed, usually at a higher rate. This weighs the two over the years you keep the loans.' | t }}
      </p>
      @if (suggestion(); as suggested) {
        <button type="button" class="try" (click)="settingsChange.emit(suggested)" data-testid="try-second-loan">
          {{ 'Try {0} at {1}% for {2} years' | t: [money(suggested.amount), decimal(suggested.annualInterestRate), suggested.termInMonths / 12] }}
        </button>
      } @else {
        <p class="note" data-testid="second-loan-none">{{ 'There is no PMI to avoid here: at least 20% is put down.' | t }}</p>
      }
    } @else {
      <div class="settings" data-testid="second-loan-settings">
        <app-number-field [control]="form.controls.amount" [rule]="rules.amount" testId="second-loan-amount" />
        <app-number-field [control]="form.controls.annualInterestRate" [rule]="rules.annualInterestRate" testId="second-loan-rate" />
        <app-number-field [control]="form.controls.termYears" [rule]="rules.termYears" testId="second-loan-term" />
        <app-number-field [control]="form.controls.yearsKept" [rule]="rules.yearsKept" testId="second-loan-years" />
      </div>
      <p class="verdict" data-testid="second-loan-verdict">{{ verdict() }}</p>
      <div class="table-wrap" tabindex="0" [attr.aria-label]="'A second loan against PMI' | t">
        <table data-testid="second-loan">
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col" [class.best]="!cheaper()">{{ 'With PMI' | t }} @if (!cheaper()) {<span class="badge">{{ 'Less' | t }}</span>}</th>
              <th scope="col" [class.best]="cheaper()">{{ 'With a second loan' | t }} @if (cheaper()) {<span class="badge">{{ 'Less' | t }}</span>}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.label) {
              <tr>
                <th scope="row">{{ row.label }}</th>
                <td [class.best]="!cheaper()">{{ row.without }}</td>
                <td [class.best]="cheaper()">{{ row.with }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{{ 'Cost over {0}' | t: [years()] }}</th>
              <td [class.best]="!cheaper()">{{ money(comparison()!.withMortgageInsurance.cost) }}</td>
              <td [class.best]="cheaper()">{{ money(comparison()!.withSecondLoan.cost) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="note" data-testid="second-loan-note">
        {{ 'Each way is the loan worked out again, with no extra payments. The cost is what you bring to closing, every payment in those years (both loans, taxes, insurance and dues) and what is still owed. The second loan’s own closing costs are not counted.' | t }}
      </p>
      <button type="button" class="link" (click)="settingsChange.emit(null)" data-testid="second-loan-stop">{{ 'Stop comparing' | t }}</button>
    }
  `,
  styleUrl: './second-loan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecondLoanComponent {
  /** The API's comparison; null until a second loan has been tried. */
  readonly comparison = input<SecondLoanComparison | null>(null);

  /** The second loan being weighed, for the boxes. */
  readonly settings = input<SecondLoanInput | null>(null);

  /** The usual second loan to offer, or null when there is no PMI to avoid. */
  readonly suggestion = input<SecondLoanInput | null>(null);

  /** The second loan changed (or, null, was dropped). */
  readonly settingsChange = output<SecondLoanInput | null>();

  protected readonly rules = SECOND_LOAN_RULES;
  protected readonly money = usd;
  protected readonly decimal = decimal;

  protected readonly form = inject(NonNullableFormBuilder).group({
    amount: [0, validatorsFor(SECOND_LOAN_RULES.amount)],
    annualInterestRate: [0, validatorsFor(SECOND_LOAN_RULES.annualInterestRate)],
    termYears: [15, validatorsFor(SECOND_LOAN_RULES.termYears)],
    yearsKept: [7, validatorsFor(SECOND_LOAN_RULES.yearsKept)],
  });

  protected readonly years = computed(() => tp(this.comparison()?.yearsKept ?? 0, '{n} year', '{n} years'));

  /** True when the second loan costs less over the years kept. */
  protected readonly cheaper = computed(() => (this.comparison()?.saved ?? 0) > 0);

  /** The answer in a sentence. */
  protected readonly verdict = computed(() => {
    const c = this.comparison();
    if (!c) return '';
    const saved = Math.abs(c.saved);
    if (c.saved === 0) return t('Over {0}, the two cost the same.', [this.years()]);
    return c.saved > 0
      ? t('Over {0}, the second loan costs {1} less than paying PMI.', [this.years(), usd(saved)])
      : t('Over {0}, the second loan costs {1} more than paying PMI.', [this.years(), usd(saved)]);
  });

  /** One row of the table, for each way. */
  protected readonly rows = computed(() => {
    const c = this.comparison();
    if (!c) return [];
    const { withMortgageInsurance: a, withSecondLoan: b } = c;
    const row = (label: string, pick: (o: typeof a) => string) => ({ label, without: pick(a), with: pick(b) });
    return [
      row(t('First loan'), (o) => usd(o.firstLoan)),
      row(t('Second loan'), (o) => (o.secondLoan ? usd(o.secondLoan) : t('None'))),
      row(t('Each month, all in'), (o) => usd(o.monthlyPayment)),
      row(t('Of which PMI'), (o) => (o.mortgageInsurance ? usd(o.mortgageInsurance) : t('None'))),
      row(t('Cash to close'), (o) => usd(o.cashToClose)),
      row(t('Paid in {0}', [this.years()]), (o) => usd(o.payments)),
      row(t('Still owed after {0}', [this.years()]), (o) => usd(o.balance)),
    ];
  });

  constructor() {
    // Every change in range weighs it again.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.form.valid) return;
      const { termYears, ...rest } = this.form.getRawValue();
      this.settingsChange.emit({ ...rest, termInMonths: termYears * 12 });
    });

    // A second loan tried from the answer, or a saved calculation's, fills the boxes.
    effect(() => {
      const s = this.settings();
      if (!s) return;
      const now = this.form.getRawValue();
      if (s.amount !== now.amount || s.annualInterestRate !== now.annualInterestRate || s.termInMonths !== now.termYears * 12 || s.yearsKept !== now.yearsKept) {
        this.form.setValue(
          { amount: s.amount, annualInterestRate: s.annualInterestRate, termYears: Math.max(1, Math.round(s.termInMonths / 12)), yearsKept: s.yearsKept },
          { emitEvent: false },
        );
      }
    });
  }
}
