import { ScrubSeries as LineSeries } from '../../../core/charts/scrub-chart.component';
import { usd } from '../../../core/formatting/format';
import { YearProjection } from '../../../core/models/amortization.models';

/**
 * The equity chart's areas, stacked: what is still owed at the bottom, the equity above it, so the top edge is the
 * home's value. Both are at the start of each year, on the plan with its extra payments.
 */
export function equityLines(projection: YearProjection[]): LineSeries[] {
  return [
    { label: 'Owed on the loan', color: '--series-2', data: projection.map((y) => y.loanBalance) },
    { label: 'Your equity', color: '--series-3', data: projection.map((y) => y.equity) },
  ];
}

/** The takeaway under the chart: where the equity starts and ends, and the year the loan is paid off, if it is. */
export function equityNote(projection: YearProjection[]): string {
  if (projection.length === 0) return '';
  const first = projection[0];
  const last = projection[projection.length - 1];
  const paidOff = projection.find((y) => y.loanBalance === 0);
  const grows = `Your equity grows from ${usd(first.equity)} (the down payment) to ${usd(last.equity)} by year ${last.year}.`;
  return paidOff ? `${grows} The loan is paid off by year ${paidOff.year}, so from then the whole home is yours.` : grows;
}

/** A year's tooltip footer: the home's value, and how much of it is yours. */
export function equityFooter(year: YearProjection): string {
  const share = year.marketValue > 0 ? Math.round((year.equity / year.marketValue) * 100) : 0;
  return `Home value: ${usd(year.marketValue)} · ${share}% yours`;
}
