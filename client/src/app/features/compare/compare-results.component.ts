import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatMonths } from '../../core/formatting/duration';
import { decimal, money, monthOf, pct } from '../../core/formatting/format';
import { MAX_HOMES, homeName } from '../../core/models/home-comparison.models';
import { ComparisonStore } from './comparison.store';
import { FIRST_YEARS, HomeFigures, cheapestHome, comparisonHeadline, figuresOf } from './comparison-figures';
import { TPipe } from '../../core/i18n/t.pipe';
import { t } from '../../core/i18n/i18n';

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
  return rounded === 0 ? '' : t('{0} pt', [`${rounded > 0 ? '+' : '−'}${decimal(Math.abs(rounded), 3)}`]);
};

/** "2 yr 5 mo sooner", "3 mo later", or nothing on the same month. */
const monthsApart = (difference: number) =>
  difference === 0 ? '' : difference < 0 ? t('{0} sooner', [formatMonths(Math.abs(difference))]) : t('{0} later', [formatMonths(Math.abs(difference))]);

const LINES: readonly Line[] = [
  { get label() { return t('Home price'); }, show: (f) => money(f.homePrice), amount: (f) => f.homePrice },
  { get label() { return t('Down payment'); }, show: (f) => t('{0} ({1})', [money(f.downPayment), pct(f.downPaymentPercent, 1)]), amount: (f) => f.downPayment },
  { get label() { return t('Loan'); }, show: (f) => money(f.loanAmount), amount: (f) => f.loanAmount },
  { get label() { return t('Rate'); }, show: (f) => pct(f.rate, 3) },
  {
    get label() { return t('APR'); }, get note() { return t('the rate counting fees'); },
    show: (f) => (f.apr === null ? '—' : pct(f.apr, 3)), amount: (f) => f.apr, better: 'lower', difference: pointsApart,
  },
  {
    get label() { return t('Monthly payment'); }, get note() { return t('the first, with housing costs'); },
    show: (f) => money(f.monthlyPayment), amount: (f) => f.monthlyPayment, better: 'lower',
  },
  {
    get label() { return t('With extra principal'); }, get note() { return t('the first payment, and what is paid ahead'); },
    show: (f) => money(f.monthlyPayment + f.extraPrincipal), amount: (f) => f.monthlyPayment + f.extraPrincipal,
    when: (homes) => homes.some((f) => f.extraPrincipal > 0),
  },
  { get label() { return t('Principal & interest'); }, show: (f) => money(f.principalAndInterest), amount: (f) => f.principalAndInterest, better: 'lower' },
  {
    get label() { return t('Housing costs'); }, get note() { return t('taxes, insurance, mortgage insurance, dues'); },
    show: (f) => money(f.housingCosts), amount: (f) => f.housingCosts, better: 'lower',
  },
  { get label() { return t('Cash to close'); }, show: (f) => (f.cashToClose === null ? '—' : money(f.cashToClose)), amount: (f) => f.cashToClose, better: 'lower' },
  {
    get label() { return t('Mortgage insurance ends'); }, show: (f) => (f.insuranceEnds ? monthOf(f.insuranceEnds) : t('None')),
    amount: (f) => (f.insuranceEnds ? monthIndex(f.insuranceEnds) : null), better: 'lower', difference: monthsApart,
  },
  {
    get label() { return t('Paid off'); }, get note() { return t('with extra payments'); }, show: (f) => monthOf(f.paidOff),
    amount: (f) => monthIndex(f.paidOff), better: 'lower', difference: monthsApart,
  },
  {
    get label() { return t('Interest over the loan'); }, get note() { return t('with extra payments'); },
    show: (f) => money(Math.round(f.interest)), amount: (f) => Math.round(f.interest), better: 'lower',
  },
  {
    get label() { return t('Cost of the first {0} years', [FIRST_YEARS]); }, get note() { return t('what builds no equity'); },
    show: (f) => money(Math.round(f.fiveYearCost)), amount: (f) => Math.round(f.fiveYearCost), better: 'lower',
  },
  {
    get label() { return t('Equity after {0} years', [FIRST_YEARS]); }, get note() { return t('value less what is owed'); },
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
  imports: [TPipe],
  selector: 'app-compare-results',
  template: `
    @if (figures(); as homes) {
      <section class="panel compare">
        <p class="headline" data-testid="compare-headline">{{ headline() }}</p>
        @if (identical()) {
          <p class="hint" data-testid="compare-hint">{{ 'These homes are still the same. Change a price, a down payment or a rate to see what differs.' | t }}</p>
        }
        @if (homes.length > 2 && !allTheSame()) {
          <ul class="each" data-testid="compare-each">
            @for (sentence of eachAgainstA(); track $index) {
              <li>{{ sentence }}</li>
            }
          </ul>
        }
        <label class="only-differences">
          <input type="checkbox" data-testid="only-differences" [checked]="onlyDifferences()" (change)="onlyDifferences.set(!onlyDifferences())" />
          {{ 'Only the rows that differ' | t }}
        </label>
        <div class="table-wrap" tabindex="0" [attr.aria-label]="'The homes side by side' | t">
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
          {{ 'Edit any home with the switch above the form, where you can add one, up to {0}. Under each figure is its difference from Home A, and the best on each line is shaded. The cost of the first {1} years is interest, taxes, insurance, mortgage insurance and dues, plus the closing costs: what is spent, not saved as equity.' | t: [maxHomes, years] }}
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

  /** True when the homes are alike in what a month, closing and the first years cost: a copy nobody has changed yet. */
  protected readonly identical = computed(() => {
    const homes = this.figures() ?? [];
    const key = (f: (typeof homes)[number]) => [Math.round(f.monthlyPayment * 100), f.cashToClose === null ? null : Math.round(f.cashToClose * 100), Math.round(f.fiveYearCost * 100)].join('|');
    return homes.length > 1 && homes.every((f) => key(f) === key(homes[0]));
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
