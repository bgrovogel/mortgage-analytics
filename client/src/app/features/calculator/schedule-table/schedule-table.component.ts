import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AmortizationResponse, HousingCosts, Payment } from '../../../core/models/amortization.models';
import { COST_CATEGORIES, CostCategory } from '../../../core/models/cost-categories';
import { monthOf } from '../../../core/formatting/format';

type View = 'accelerated' | 'baseline';
type Period = 'monthly' | 'yearly';
type CostKey = CostCategory['key'];

/** One table row: a single payment, or a loan year's payments added together. */
export interface ScheduleRow {
  /** Payment number, or loan year number. */
  number: number;
  /** "Jan 2026" for a payment, "2026" for a year (the calendar year it starts in). */
  when: string;
  scheduledPayment: number;
  principal: number;
  interest: number;
  extraPrincipal: number;
  /** Housing costs, by category. */
  costs: Record<CostKey, number>;
  housingCosts: number;
  totalOutlay: number;
  /** The balance after the row's last payment. */
  remainingBalance: number;
  /** True when any payment in the row included PMI. */
  includesPmi: boolean;
  /** True when a recast followed this payment (monthly rows only). */
  recast: boolean;
}

/** A money column the user can show or hide. */
export interface ScheduleColumn {
  key: string;
  label: string;
  value: (row: ScheduleRow) => number;
}

/** Where the chosen columns are remembered, per browser. */
export const COLUMNS_STORAGE_KEY = 'schedule-columns';

const utcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const sum = <T>(items: T[], pick: (item: T) => number) => items.reduce((total, item) => total + pick(item), 0);

const LOAN_COLUMNS: ScheduleColumn[] = [
  { key: 'principal', label: 'Principal', value: (r) => r.principal },
  { key: 'interest', label: 'Interest', value: (r) => r.interest },
  { key: 'extraPrincipal', label: 'Extra', value: (r) => r.extraPrincipal },
];
const COST_COLUMNS: ScheduleColumn[] = COST_CATEGORIES.map((c) => ({ key: c.key, label: c.label, value: (r) => r.costs[c.key] }));
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
  imports: [CurrencyPipe],
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

  /** Payment numbers that were followed by a recast, so their rows can be marked. */
  readonly recastAfter = computed(() => new Set(this.schedule().recasts.map((r) => r.afterPaymentNumber)));

  /** Every money column this schedule can show: the loan columns, plus each cost it actually has. */
  readonly available = computed<ScheduleColumn[]>(() => {
    if (!this.hasHousingCosts()) return LOAN_COLUMNS;
    const totals = this.schedule().totalHousingCosts;
    return [...LOAN_COLUMNS, ...COST_COLUMNS.filter((c) => totals[c.key as CostKey] > 0), ...SUMMARY_COLUMNS];
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

  /** The whole schedule added up as one row: the source of the footer and the lifetime summary. */
  readonly totals = computed(() => this.toRow(0, '', this.schedule().payments));

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
      includesPmi: payments.some((p) => p.costs.mortgageInsurance > 0),
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
