import { formatMonths } from '../../../core/formatting/duration';
import { usd } from '../../../core/formatting/format';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { mortgageInsuranceName } from '../../../core/models/cost-categories';
import { t } from '../../../core/i18n/i18n';

/** A date a buyer acts on or looks forward to. */
export interface Milestone {
  id: 'pmi' | 'half' | 'paid';
  title: string;
  detail: string;
  /** The month it falls in, as the schedule has it (YYYY-MM-DD, the first of the month). */
  date: string;
}

/**
 * The dates worth putting in a calendar, from the schedule with extra payments: when to ask for the mortgage insurance
 * to come off (when waiting for it to end by itself would cost more), when half the loan is paid, and when it is paid
 * off. Nothing is invented: each date is a payment on the schedule.
 */
export function milestones(result: AmortizationResponse): Milestone[] {
  const schedule = result.accelerated;
  const out: Milestone[] = [];
  const insurance = mortgageInsuranceName(result.program);

  const ask = schedule.mortgageInsuranceEndDate;
  const other = result.pmiOtherChoice;
  if (ask && other?.removal === 'Automatic' && other.savedByAsking > 0) {
    out.push({
      id: 'pmi', title: t('Ask to drop {0}', [insurance]), detail: t('Saves {0} against waiting for it to come off by itself', [usd(other.savedByAsking)]), date: ask,
    });
  }

  const first = schedule.payments[0];
  if (first) {
    const opening = first.remainingBalance + first.principal + first.extraPrincipal;
    const half = schedule.payments.find((p) => p.remainingBalance <= opening / 2);
    if (half) out.push({ id: 'half', title: t('Half paid'), detail: t('What you own passes what you owe'), date: half.dueDate });
  }

  const sooner = result.savings.paymentsSaved;
  out.push({
    id: 'paid', title: t('Free and clear'),
    detail: sooner > 0 ? t('{0} sooner than scheduled', [formatMonths(sooner)]) : t('The last payment'),
    date: result.savings.acceleratedPayoffDate,
  });
  return out;
}

/** The characters an iCalendar text value must escape. */
const escapeText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/**
 * An iCalendar file with one all-day event for each milestone, for a calendar to import. The stamp is the event's own
 * date, so the same file is produced every time (it carries nothing about when it was made, or by whom).
 */
export function icsCalendar(items: readonly Milestone[], domain: string): string {
  const day = (iso: string) => iso.slice(0, 10).replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mortgage Analytics//Key dates//EN', 'CALSCALE:GREGORIAN',
    ...items.flatMap((m) => [
      'BEGIN:VEVENT', `UID:${m.id}-${day(m.date)}@${domain}`, `DTSTAMP:${day(m.date)}T000000Z`, `DTSTART;VALUE=DATE:${day(m.date)}`,
      `SUMMARY:${escapeText(m.title)}`, `DESCRIPTION:${escapeText(m.detail)}`, 'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
