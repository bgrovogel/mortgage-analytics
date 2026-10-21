import { ScrubSeries as LineSeries } from '../../../core/charts/scrub-chart.component';
import { usd } from '../../../core/formatting/format';
import { YearProjection } from '../../../core/models/amortization.models';
import { t } from '../../../core/i18n/i18n';

/**
 * The equity chart's areas, stacked: what is still owed at the bottom, the equity above it, so the top edge is the
 * home's value. Both are at the start of each year, on the plan with its extra payments.
 */
export function equityLines(projection: YearProjection[]): LineSeries[] {
  return [
    { get label() { return t('Owed on the loan'); }, color: '--series-2', data: projection.map((y) => y.loanBalance) },
    { get label() { return t('Your equity'); }, color: '--series-3', data: projection.map((y) => y.equity) },
  ];
}

/** The takeaway under the chart: where the equity starts and ends, and the year the loan is paid off, if it is. */
export function equityNote(projection: YearProjection[]): string {
  if (projection.length === 0) return '';
  const first = projection[0];
  const last = projection[projection.length - 1];
  const paidOff = projection.find((y) => y.loanBalance === 0);
  const grows = t('Your equity grows from {0} (the down payment) to {1} by year {2}.', [usd(first.equity), usd(last.equity), last.year]);
  return paidOff ? `${grows} ${t('The loan is paid off by year {0}, so from then the whole home is yours.', [paidOff.year])}` : grows;
}

/** A year's tooltip footer: the home's value, and how much of it is yours. */
export function equityFooter(year: YearProjection): string {
  const share = year.marketValue > 0 ? Math.round((year.equity / year.marketValue) * 100) : 0;
  return t('Home value: {0} · {1}% yours', [usd(year.marketValue), share]);
}
