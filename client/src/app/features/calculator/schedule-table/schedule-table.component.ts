import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { AmortizationResponse, Payment } from '../../../core/models/amortization.models';

type View = 'accelerated' | 'baseline';
type Period = 'monthly' | 'yearly';

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
  housingCosts: number;
  totalOutlay: number;
  /** The balance after the row's last payment. */
  remainingBalance: number;
  /** True when any payment in the row included PMI. */
  includesPmi: boolean;
  /** True when a recast followed this payment (monthly rows only). */
  recast: boolean;
}

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const utcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const sum = (payments: Payment[], pick: (p: Payment) => number) => payments.reduce((total, p) => total + pick(p), 0);

/**
 * The full schedule, month by month or rolled up by loan year. It doubles as the accessible table
 * view of the charts. Totals are computed per column, so each sits under its own header.
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

  /** The schedule currently shown. */
  readonly schedule = computed(() => this.result()[this.view()]);

  /** True when any housing cost is present, which adds the "Taxes & fees" and "Total" columns. */
  readonly hasHousingCosts = computed(() => this.schedule().totalHousingCosts.total > 0);

  /** Payment numbers that were followed by a recast, so their rows can be marked. */
  readonly recastAfter = computed(() => new Set(this.schedule().recasts.map((r) => r.afterPaymentNumber)));

  /** The rows for the current schedule and period. */
  readonly rows = computed<ScheduleRow[]>(() => {
    const payments = this.schedule().payments;
    return this.period() === 'monthly'
      ? payments.map((p) => this.toRow(p.paymentNumber, monthYear.format(utcDate(p.dueDate)), [p]))
      : this.byYear(payments);
  });

  /** Column totals across the whole schedule, the same in either period. */
  readonly totals = computed(() => {
    const payments = this.schedule().payments;
    return {
      scheduledPayment: sum(payments, (p) => p.scheduledPayment),
      principal: sum(payments, (p) => p.principal),
      interest: sum(payments, (p) => p.interest),
      extraPrincipal: sum(payments, (p) => p.extraPrincipal),
      housingCosts: sum(payments, (p) => p.housingCosts),
      totalOutlay: sum(payments, (p) => p.totalOutlay),
    };
  });

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
      housingCosts: sum(payments, (p) => p.housingCosts),
      totalOutlay: sum(payments, (p) => p.totalOutlay),
      remainingBalance: last.remainingBalance,
      includesPmi: payments.some((p) => p.mortgageInsurance > 0),
      recast: payments.length === 1 && this.recastAfter().has(last.paymentNumber),
    };
  }
}
