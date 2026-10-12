import { YearProjection } from '../../../core/models/amortization.models';
import { COST_CATEGORIES } from '../../../core/models/cost-categories';

/** One cost's figures for a chosen year: that year, every year up to it, and the whole loan. */
export interface CostTotalRow {
  label: string;
  /** The category's colour token, as the chart draws it. */
  color: string;
  thisYear: number;
  toDate: number;
  wholeLoan: number;
}

/** Every cost together, with what the chosen year comes to each month. */
export interface CostTotal {
  thisYear: number;
  monthly: number;
  toDate: number;
  wholeLoan: number;
}

/**
 * The projection's quick numbers for loan year `year` (1-based): each cost that year, through that year, and over
 * the whole term, plus their total. Costs never paid are left out, as the chart leaves them out.
 */
export function costTotals(projection: readonly YearProjection[], year: number): { rows: CostTotalRow[]; total: CostTotal } {
  const sum = (years: readonly YearProjection[], pick: (y: YearProjection) => number) => years.reduce((s, y) => s + pick(y), 0);
  const toDate = projection.slice(0, year);
  const thisYear = projection[year - 1];

  const rows = COST_CATEGORIES
    .filter((c) => projection.some((y) => y.costs[c.key] > 0))
    .map((c) => ({
      label: c.label,
      color: c.color,
      thisYear: thisYear.costs[c.key],
      toDate: sum(toDate, (y) => y.costs[c.key]),
      wholeLoan: sum(projection, (y) => y.costs[c.key]),
    }));

  return {
    rows,
    total: {
      thisYear: thisYear.costs.total,
      monthly: Math.round((thisYear.costs.total / 12) * 100) / 100,
      toDate: sum(toDate, (y) => y.costs.total),
      wholeLoan: sum(projection, (y) => y.costs.total),
    },
  };
}

/**
 * The year to show first: the loan year `today` falls in, for a loan already being paid, so "through that year" is
 * what has been paid; year 1 for a loan not started yet; the last year once it is over.
 */
export function startingYear(projection: readonly YearProjection[], today: Date): number {
  const started = projection.filter((y) => new Date(y.startDate) <= today);
  return Math.max(1, started.at(-1)?.year ?? 1);
}
