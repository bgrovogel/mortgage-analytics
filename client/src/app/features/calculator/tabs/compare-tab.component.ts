import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { money, monthOf, pct } from '../../../core/formatting/format';
import { ComparisonStore } from '../comparison.store';
import { FIRST_YEARS, HomeFigures, comparisonHeadline, figuresOf } from '../compare/comparison-figures';

/** One line of the comparison: how to show a figure, and whether the difference between the homes means anything. */
interface Line {
  label: string;
  /** A smaller line under the label. */
  note?: string;
  show: (f: HomeFigures) => string;
  /** The amount compared, when a difference is worth showing; dates and rates have none. */
  amount?: (f: HomeFigures) => number | null;
}

const LINES: readonly Line[] = [
  { label: 'Home price', show: (f) => money(f.homePrice), amount: (f) => f.homePrice },
  { label: 'Down payment', show: (f) => `${money(f.downPayment)} (${pct(f.downPaymentPercent, 1)})`, amount: (f) => f.downPayment },
  { label: 'Loan', show: (f) => money(f.loanAmount), amount: (f) => f.loanAmount },
  { label: 'Rate', show: (f) => pct(f.rate, 3) },
  { label: 'Monthly payment', note: 'the first, with housing costs', show: (f) => money(f.monthlyPayment), amount: (f) => f.monthlyPayment },
  { label: 'Principal & interest', show: (f) => money(f.principalAndInterest), amount: (f) => f.principalAndInterest },
  { label: 'Housing costs', note: 'taxes, insurance, mortgage insurance, dues', show: (f) => money(f.housingCosts), amount: (f) => f.housingCosts },
  { label: 'Cash to close', show: (f) => (f.cashToClose === null ? '—' : money(f.cashToClose)), amount: (f) => f.cashToClose },
  { label: 'Mortgage insurance ends', show: (f) => (f.insuranceEnds ? monthOf(f.insuranceEnds) : 'None') },
  { label: 'Paid off', note: 'with extra payments', show: (f) => monthOf(f.paidOff) },
  { label: 'Interest over the loan', note: 'with extra payments', show: (f) => money(Math.round(f.interest)), amount: (f) => Math.round(f.interest) },
  {
    label: `Cost of the first ${FIRST_YEARS} years`, note: 'what builds no equity',
    show: (f) => money(Math.round(f.fiveYearCost)), amount: (f) => Math.round(f.fiveYearCost),
  },
  {
    label: `Equity after ${FIRST_YEARS} years`, note: 'value less what is owed',
    show: (f) => money(Math.round(f.equityAfterFiveYears)), amount: (f) => Math.round(f.equityAfterFiveYears),
  },
];

/** "+$350.50", "−$8,081", or nothing when the homes are level. */
function signedMoney(difference: number): string {
  const rounded = Math.round(difference * 100) / 100;
  return rounded === 0 ? '' : `${rounded > 0 ? '+' : '−'}${money(Math.abs(rounded))}`;
}

/**
 * Two homes side by side: the one in the form (Home A) and a second (Home B), each any loan the calculator takes.
 * One line sums up what Home B costs more or less; the table shows each figure and the difference.
 */
@Component({
  selector: 'app-compare-tab',
  template: `
    @if (figures(); as f) {
      <section class="panel compare">
        <p class="headline" data-testid="compare-headline">{{ headline() }}</p>
        <div class="table-wrap">
          <table data-testid="compare-table">
            <thead>
              <tr><td></td><th scope="col">Home A</th><th scope="col">Home B</th><th scope="col" class="difference">Difference</th></tr>
            </thead>
            <tbody>
              @for (line of lines; track line.label) {
                <tr>
                  <th scope="row">{{ line.label }}@if (line.note) {<small>{{ line.note }}</small>}</th>
                  <td>{{ line.show(f.a) }}</td>
                  <!-- A phone has no room for the Difference column: there it goes under Home B's figure. -->
                  @let gap = difference(line, f.a, f.b);
                  <td>{{ line.show(f.b) }}@if (gap) {<small class="under">{{ gap }}</small>}</td>
                  <td class="difference">{{ gap }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="note">
          Edit either home with the switch above the form. The cost of the first {{ years }} years is interest, taxes,
          insurance, mortgage insurance and dues, plus the closing costs: what is spent, not saved as equity.
        </p>
      </section>
    }
  `,
  styleUrls: ['./result-tab.scss', './compare-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareTabComponent {
  private readonly store = inject(ComparisonStore);

  protected readonly lines = LINES;
  protected readonly years = FIRST_YEARS;

  /** Each home's figures, once both are calculated. */
  protected readonly figures = computed(() => {
    const result = this.store.result();
    return result ? { a: figuresOf(result.first), b: figuresOf(result.second) } : null;
  });

  protected readonly headline = computed(() => {
    const f = this.figures();
    return f ? comparisonHeadline(f.a, f.b) : '';
  });

  /** Home B less Home A, for the lines where that means something. */
  protected difference(line: Line, a: HomeFigures, b: HomeFigures): string {
    const first = line.amount?.(a);
    const second = line.amount?.(b);
    return first == null || second == null ? '' : signedMoney(second - first);
  }
}
