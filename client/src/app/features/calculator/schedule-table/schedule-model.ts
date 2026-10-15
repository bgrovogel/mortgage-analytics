import type { CostCategory } from '../../../core/models/cost-categories';

/** The key of one housing cost. */
export type CostKey = CostCategory['key'];

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
  /** True when the row holds the last payment with PMI: from the next one, it is gone. */
  pmiEnds: boolean;
  /** True when a recast followed this payment (monthly rows only). */
  recast: boolean;
}

/** A money column the user can show or hide. */
export interface ScheduleColumn {
  key: string;
  label: string;
  value: (row: ScheduleRow) => number;
}
