import type { ScheduleColumn, ScheduleRow } from './schedule-model';

/** A field as CSV writes it: quoted when it holds a comma, a quote or a line break, with quotes doubled. */
const field = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/** An amount to the cent, as a plain number (no currency sign or thousands separators) a spreadsheet can add up. */
const amount = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

/**
 * The schedule as CSV (RFC 4180): the payment, each of the given columns, and the balance after, for every row, with
 * the rows' own heading for a monthly or a yearly schedule. Lines end CRLF, and the last one too.
 */
export function scheduleCsv(rows: readonly ScheduleRow[], columns: readonly ScheduleColumn[], period: 'monthly' | 'yearly'): string {
  const heading = [period === 'monthly' ? '#' : 'Year', period === 'monthly' ? 'Date' : 'Starts', 'Payment', ...columns.map((c) => c.label), 'Balance'];
  const lines = rows.map((row) => [
    String(row.number), row.when, amount(row.scheduledPayment), ...columns.map((c) => amount(c.value(row))), amount(row.remainingBalance),
  ]);
  return [heading, ...lines].map((cells) => cells.map(field).join(',')).join('\r\n') + '\r\n';
}
