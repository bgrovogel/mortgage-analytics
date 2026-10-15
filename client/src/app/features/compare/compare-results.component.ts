import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatMonths } from '../../core/formatting/duration';
import { decimal, money, monthOf, pct } from '../../core/formatting/format';
import { MAX_HOMES, homeName } from '../../core/models/home-comparison.models';
import { ComparisonStore } from './comparison.store';
import { FIRST_YEARS, HomeFigures, cheapestHome, comparisonHeadline, figuresOf } from './comparison-figures';

/** One line of the comparison: how to show a figure, whether a difference between homes means anything, and which way is better. */
interface Line {
  label: string;
  /** A smaller line under the label. */
  note?: string;
  show: (f: HomeFigures) => string;
  /** The amount compared, when a difference is worth showing; dates and rates have none. */
  amount?: (f: HomeFigures) => number | null;
  /** Whether less or more of the amount is better, for the lines where one is: the best home is marked. */
  better?: 'lower' | 'higher';
  /** How a difference from Home A reads: in dollars unless said otherwise. */
  difference?: (difference: number) => string;
  /** Whether the line is shown for these homes: always, unless said otherwise. */
  when?: (homes: HomeFigures[]) => boolean;
}

/** A date as a count of months, so two dates' difference is in months. */
const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

/** "+0.05 pt", "−0.02 pt": a difference between two rates, or nothing when they match to a thousandth. */
const pointsApart = (difference: number) => {
  const rounded = Math.round(difference * 1_000) / 1_000;
  return rounded === 0 ? '' : `${rounded > 0 ? '+' : '−'}${decimal(Math.abs(rounded), 3)} pt`;
};

/** "2 yr 5 mo sooner", "3 mo later", or nothing on the same month. */
const monthsApart = (difference: number) =>
  difference === 0 ? '' : `${formatMonths(Math.abs(difference))} ${difference < 0 ? 'sooner' : 'later'}`;

const LINES: readonly Line[] = [
  { label: 'Home price', show: (f) => money(f.homePrice), amount: (f) => f.homePrice },
  { label: 'Down payment', show: (f) => `${money(f.downPayment)} (${pct(f.downPaymentPercent, 1)})`, amount: (f) => f.downPayment },
  { label: 'Loan', show: (f) => money(f.loanAmount), amount: (f) => f.loanAmount },
  { label: 'Rate', show: (f) => pct(f.rate, 3) },
  {
    label: 'APR', note: 'the rate counting fees',
    show: (f) => (f.apr === null ? '—' : pct(f.apr, 3)), amount: (f) => f.apr, better: 'lower', difference: pointsApart,
  },
  {
    label: 'Monthly payment', note: 'the first, with housing costs',
    show: (f) => money(f.monthlyPayment), amount: (f) => f.monthlyPayment, better: 'lower',
  },
  {
    label: 'With extra principal', note: 'the first payment, and what is paid ahead',
    show: (f) => money(f.monthlyPayment + f.extraPrincipal), amount: (f) => f.monthlyPayment + f.extraPrincipal,
    when: (homes) => homes.some((f) => f.extraPrincipal > 0),
  },
  { label: 'Principal & interest', show: (f) => money(f.principalAndInterest), amount: (f) => f.principalAndInterest, better: 'lower' },
  {
    label: 'Housing costs', note: 'taxes, insurance, mortgage insurance, dues',
    show: (f) => money(f.housingCosts), amount: (f) => f.housingCosts, better: 'lower',
  },
  { label: 'Cash to close', show: (f) => (f.cashToClose === null ? '—' : money(f.cashToClose)), amount: (f) => f.cashToClose, better: 'lower' },
  {
    label: 'Mortgage insurance ends', show: (f) => (f.insuranceEnds ? monthOf(f.insuranceEnds) : 'None'),
    amount: (f) => (f.insuranceEnds ? monthIndex(f.insuranceEnds) : null), better: 'lower', difference: monthsApart,
  },
  {
    label: 'Paid off', note: 'with extra payments', show: (f) => monthOf(f.paidOff),
    amount: (f) => monthIndex(f.paidOff), better: 'lower', difference: monthsApart,
  },
  {
    label: 'Interest over the loan', note: 'with extra payments',
    show: (f) => money(Math.round(f.interest)), amount: (f) => Math.round(f.interest), better: 'lower',
  },
  {
    label: `Cost of the first ${FIRST_YEARS} years`, note: 'what builds no equity',
    show: (f) => money(Math.round(f.fiveYearCost)), amount: (f) => Math.round(f.fiveYearCost), better: 'lower',
  },
  {
    label: `Equity after ${FIRST_YEARS} years`, note: 'value less what is owed',
    show: (f) => money(Math.round(f.equityAfterFiveYears)), amount: (f) => Math.round(f.equityAfterFiveYears), better: 'higher',
  },
];

/** "+$350.50", "−$8,081", or nothing when the homes are level. */
function signedMoney(difference: number): string {
  const rounded = Math.round(difference * 100) / 100;
  return rounded === 0 ? '' : `${rounded > 0 ? '+' : '−'}${money(Math.abs(rounded))}`;
}

/** One row of the table: each home's figure, its difference from Home A, and whether it is the best. */
interface Row {
  line: Line;
  cells: { value: string; difference: string; best: boolean }[];
}

/**
 * Two to four homes side by side: the one in the form (Home A) and the others, each any loan the calculator takes.
 * Every figure of another home has its difference from Home A under it, and on the lines where less (or more) is
 * better, the best home is marked. Two homes are summed up in one line; more in a line each, after the cheapest.
 */
@Component({
  selector: 'app-compare-results',
  template: `
    @if (figures(); as homes) {
      <section class="panel compare">
        <p class="headline" data-testid="compare-headline">{{ headline() }}</p>
        @if (homes.length > 2 && !allTheSame()) {
          <ul class="each" data-testid="compare-each">
            @for (sentence of eachAgainstA(); track $index) {
              <li>{{ sentence }}</li>
            }
          </ul>
        }
        <label class="only-differences">
          <input type="checkbox" data-testid="only-differences" [checked]="onlyDifferences()" (change)="onlyDifferences.set(!onlyDifferences())" />
          Only the rows that differ
        </label>
        <div class="table-wrap" tabindex="0" aria-label="The homes side by side">
          <table data-testid="compare-table" [class]="'homes-' + homes.length" [style.--homes]="homes.length">
            <thead>
              <tr>
                <td></td>
                @for (f of homes; track $index) {
                  <th scope="col">{{ nameOf($index) }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.line.label) {
                <tr>
                  <th scope="row">{{ row.line.label }}@if (row.line.note) {<small>{{ row.line.note }}</small>}</th>
                  @for (cell of row.cells; track $index) {
                    <td [class.best]="cell.best" [attr.data-home]="nameOf($index)">{{ cell.value }} @if (cell.difference) {<small class="under">{{ cell.difference }}</small>}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="note">
          Edit any home with the switch above the form, where you can add one, up to {{ maxHomes }}. Under each figure is
          its difference from Home A, and the best on each line is shaded. The cost of the first {{ years }} years is
          interest, taxes, insurance, mortgage insurance and dues, plus the closing costs: what is spent, not saved as equity.
        </p>
      </section>
    }
  `,
  styleUrl: './compare-results.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareResultsComponent {
  private readonly store = inject(ComparisonStore);

  protected readonly years = FIRST_YEARS;
  protected readonly maxHomes = MAX_HOMES;
  protected readonly nameOf = homeName;

  /** Each home's figures, once all are calculated. */
  protected readonly figures = computed(() => this.store.result()?.homes.map(figuresOf) ?? null);

  /** Two homes: what Home B costs more or less. More: which costs the least over the first years. */
  protected readonly headline = computed(() => {
    const homes = this.figures();
    if (!homes || homes.length < 2) return '';
    return homes.length === 2 ? comparisonHeadline(homes[0], homes[1]) : cheapestHome(homes);
  });

  /** True when every home costs the same over the first years: then a line each would only repeat it. */
  protected readonly allTheSame = computed(() => {
    const costs = (this.figures() ?? []).map((f) => Math.round(f.fiveYearCost));
    return costs.every((c) => c === costs[0]);
  });

  /** Each home after Home A, measured against it. */
  protected readonly eachAgainstA = computed(() => {
    const [a, ...others] = this.figures() ?? [];
    return others.map((f, i) => comparisonHeadline(a, f, homeName(i + 1)));
  });

  /** True to leave out the rows where every home has the same figure, so only what sets them apart is left. */
  protected readonly onlyDifferences = signal(false);

  protected readonly rows = computed<Row[]>(() => {
    const homes = this.figures() ?? [];
    const rows = this.allRows(homes);
    return this.onlyDifferences() ? rows.filter((row) => row.cells.some((cell) => cell.value !== row.cells[0].value)) : rows;
  });

  private allRows(homes: HomeFigures[]): Row[] {
    return LINES.filter((line) => line.when?.(homes) ?? true).map((line) => {
      const amounts = homes.map((f) => line.amount?.(f) ?? null);
      const best = bestOf(amounts, line.better);
      return {
        line,
        cells: homes.map((f, i) => ({
          value: line.show(f),
          difference: i === 0 || amounts[0] === null || amounts[i] === null ? '' : (line.difference ?? signedMoney)(amounts[i]! - amounts[0]),
          best: best !== null && amounts[i] === best,
        })),
      };
    });
  }
}

/** The best amount on a line where lower or higher is better, or null when there is no better or every home is level. */
function bestOf(amounts: (number | null)[], better: Line['better']): number | null {
  const known = amounts.filter((a): a is number => a !== null);
  if (!better || known.length < 2 || known.every((a) => a === known[0])) return null;
  return better === 'lower' ? Math.min(...known) : Math.max(...known);
}
