import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AmortizationResponse, HousingCosts, Payment } from '../../../core/models/amortization.models';
import { COST_CATEGORIES, CostCategory, costCategoriesFor, mortgageInsuranceName } from '../../../core/models/cost-categories';
import { monthOf } from '../../../core/formatting/format';
import { nextPayment } from '../answer-sentence';
import { scheduleCsv } from './schedule-csv';
import type { CostKey, ScheduleColumn, ScheduleRow } from './schedule-model';
import { SchedulePagerComponent, SchedulePage } from './schedule-pager.component';
import { ScheduleTotalsComponent } from './schedule-totals.component';

export type { ScheduleColumn, ScheduleRow } from './schedule-model';

type View = 'accelerated' | 'baseline';
type Period = 'monthly' | 'yearly';

/** Where the chosen columns are remembered, per browser. */
export const COLUMNS_STORAGE_KEY = 'schedule-columns';

const utcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0);

const LOAN_COLUMNS: ScheduleColumn[] = [
  { key: 'principal', label: 'Principal', value: (r) => r.principal },
  { key: 'interest', label: 'Interest', value: (r) => r.interest },
  { key: 'extraPrincipal', label: 'Extra', value: (r) => r.extraPrincipal },
];
/** One column per cost, named for the loan (an FHA loan's mortgage insurance is MIP). */
const costColumns = (categories: readonly CostCategory[]): ScheduleColumn[] =>
  categories.map((c) => ({ key: c.key, label: c.label, value: (r) => r.costs[c.key] }));
const SUMMARY_COLUMNS: ScheduleColumn[] = [
  { key: 'housingCosts', label: 'Housing costs', value: (r) => r.housingCosts },
  { key: 'totalOutlay', label: 'Total', value: (r) => r.totalOutlay },
];

/** Shown until the user chooses: everything except the separate cost categories, which "Housing costs" sums up. */
const DEFAULT_HIDDEN: readonly string[] = COST_CATEGORIES.map((c) => c.key);

/**
 * The full schedule, month by month or rolled up by loan year. It doubles as the accessible table
 * view of the charts. Which money columns show is up to the user (remembered in this browser), and a
 * summary above the table always totals every cost over the whole schedule.
 */
@Component({
  selector: 'app-schedule-table',
  imports: [CurrencyPipe, SchedulePagerComponent, ScheduleTotalsComponent],
  templateUrl: './schedule-table.component.html',
  styleUrl: './schedule-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTableComponent {
  /** The analysis whose schedules are shown. */
  readonly result = input.required<AmortizationResponse>();

  /** Which schedule the table shows. */
  readonly view = signal<View>('accelerated');

  /** Whether rows are single payments or whole loan years. */
  readonly period = signal<Period>('monthly');

  /** Keys of the money columns the user has hidden. */
  readonly hidden = signal<ReadonlySet<string>>(new Set(loadHidden()));

  /** The schedule currently shown. */
  readonly schedule = computed(() => this.result()[this.view()]);

  /** True when any housing cost is present, which brings in the cost columns. */
  readonly hasHousingCosts = computed(() => this.schedule().totalHousingCosts.total > 0);

  /** What the loan's mortgage insurance is called, for the tag where it ends. */
  readonly insuranceName = computed(() => mortgageInsuranceName(this.result().program));

  /** Payment numbers that were followed by a recast, so their rows can be marked. */
  readonly recastAfter = computed(() => new Set(this.schedule().recasts.map((r) => r.afterPaymentNumber)));

  /**
   * The last payment that includes PMI, when PMI stops before the loan does; null otherwise. The schedule tags it
   * ("PMI ends") rather than every month that has PMI, which said nothing new on each row.
   */
  readonly lastPmiPayment = computed(() => {
    const payments = this.schedule().payments;
    const withPmi = payments.filter((p) => p.costs.mortgageInsurance > 0);
    const last = withPmi.at(-1);
    return last && last !== payments.at(-1) ? last.paymentNumber : null;
  });

  /** Every money column this schedule can show: the loan columns, plus each cost it actually has. */
  readonly available = computed<ScheduleColumn[]>(() => {
    if (!this.hasHousingCosts()) return LOAN_COLUMNS;
    const totals = this.schedule().totalHousingCosts;
    const costs = costColumns(costCategoriesFor(this.result().program));
    return [...LOAN_COLUMNS, ...costs.filter((c) => totals[c.key as CostKey] > 0), ...SUMMARY_COLUMNS];
  });

  /** The money columns shown, in order. */
  readonly columns = computed(() => this.available().filter((c) => !this.hidden().has(c.key)));

  /** The rows for the current schedule and period. */
  readonly rows = computed<ScheduleRow[]>(() => {
    const payments = this.schedule().payments;
    return this.period() === 'monthly'
      ? payments.map((p) => this.toRow(p.paymentNumber, monthOf(p.dueDate), [p]))
      : this.byYear(payments);
  });

  /** The loan years the schedule runs through, for paging through them. */
  readonly loanYears = computed(() => Array.from({ length: Math.ceil(this.schedule().payments.length / 12) }, (_, i) => i + 1));

  /** What the reader chose to see: a loan year, or all of it; null until they choose. */
  private readonly chosen = signal<number | 'all' | null>(null);

  /** The loan year the table opens on: the one with the next payment on a loan being paid, else the first. */
  private readonly openingYear = computed(() => {
    const next = nextPayment(this.result());
    return next ? Math.ceil(next.paymentNumber / 12) : 1;
  });

  /** The loan year shown, kept within the schedule (the other schedule may be a shorter one), or 'all'. */
  readonly page = computed(() => {
    const wanted = this.chosen() ?? this.openingYear();
    return wanted === 'all' ? wanted : Math.min(Math.max(wanted, 1), this.loanYears().length);
  });

  /** Whether the monthly rows come a loan year at a time: not for a single year, nor the yearly rows. */
  readonly paged = computed(() => this.period() === 'monthly' && this.loanYears().length > 1);

  /** The rows on the table: a loan year of payments, or every row. (The spreadsheet always has them all.) */
  readonly shownRows = computed(() => {
    const page = this.page();
    return this.paged() && page !== 'all' ? this.rows().slice((page - 1) * 12, page * 12) : this.rows();
  });

  /** Which payments are on show, said in words. */
  readonly pageCaption = computed(() => {
    const page = this.page();
    const count = this.schedule().payments.length;
    if (page === 'all') return `All ${count} payments`;
    const last = Math.min(page * 12, count);
    return `Payments ${(page - 1) * 12 + 1}–${last} of ${count}, loan year ${page}`;
  });

  /** Shows the loan year (or all of them) the pager asked for. */
  protected show(page: SchedulePage): void {
    this.chosen.set(page);
  }

  /** The loan year a row is in: its own number in the yearly view, payment 1 to 12 being year 1 in the monthly one. */
  protected yearOf(row: ScheduleRow): number {
    return this.period() === 'monthly' ? Math.ceil(row.number / 12) : row.number;
  }

  /** The whole schedule added up as one row: the source of the footer and the lifetime summary. */
  readonly totals = computed(() => this.toRow(0, '', this.schedule().payments));

  /**
   * Saves the schedule shown as a spreadsheet: every payment (or year), with every column the schedule has, whichever
   * are hidden from the table, since a spreadsheet can hide its own.
   */
  download(): void {
    const csv = scheduleCsv(this.rows(), this.available(), this.period());
    const name = `payment-schedule-${this.period()}-${this.view() === 'accelerated' ? 'with-extra-payments' : 'standard'}.csv`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Shows or hides a money column, and remembers the choice. */
  toggle(key: string): void {
    const hidden = new Set(this.hidden());
    if (!hidden.delete(key)) hidden.add(key);
    this.hidden.set(hidden);
    saveHidden([...hidden]);
  }

  /** Groups payments into loan years of twelve, labelled with the calendar year each starts in. */
  private byYear(payments: Payment[]): ScheduleRow[] {
    const rows: ScheduleRow[] = [];
    for (let start = 0; start < payments.length; start += 12) {
      const year = payments.slice(start, start + 12);
      rows.push(this.toRow(start / 12 + 1, String(utcDate(year[0].dueDate).getUTCFullYear()), year));
    }
    return rows;
  }

  private toRow(number: number, when: string, payments: Payment[]): ScheduleRow {
    const last = payments[payments.length - 1];
    return {
      number,
      when,
      scheduledPayment: sum(payments, (p) => p.scheduledPayment),
      principal: sum(payments, (p) => p.principal),
      interest: sum(payments, (p) => p.interest),
      extraPrincipal: sum(payments, (p) => p.extraPrincipal),
      costs: Object.fromEntries(COST_CATEGORIES.map((c) => [c.key, sum(payments, (p) => costOf(p.costs, c.key))])) as Record<CostKey, number>,
      housingCosts: sum(payments, (p) => p.housingCosts),
      totalOutlay: sum(payments, (p) => p.totalOutlay),
      remainingBalance: last.remainingBalance,
      pmiEnds: payments.some((p) => p.paymentNumber === this.lastPmiPayment()),
      recast: payments.length === 1 && this.recastAfter().has(last.paymentNumber),
    };
  }
}

const costOf = (costs: HousingCosts, key: CostKey) => costs[key];

/** The saved choice, or the default. Storage can be blocked (private windows, settings), so failures fall back. */
function loadHidden(): readonly string[] {
  try {
    const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as string[]) : DEFAULT_HIDDEN;
  } catch {
    return DEFAULT_HIDDEN;
  }
}

function saveHidden(hidden: string[]): void {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    // Not remembered this time; the table still works.
  }
}
