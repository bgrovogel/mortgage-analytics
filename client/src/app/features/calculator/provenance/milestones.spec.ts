import { aPayment, aResponse, aSavings, aSchedule } from '../../../../testing/builders';
import { icsCalendar, milestones } from './milestones';

describe('milestones', () => {
  /** A 4-payment loan of $1,000 paying $250 a month; paid off in April 2027. */
  const loan = () => aSchedule({
    payments: [1, 2, 3, 4].map((n) => aPayment(n, { dueDate: `2027-0${n}-01`, principal: 250, extraPrincipal: 0, remainingBalance: 1_000 - n * 250 })),
    mortgageInsuranceEndDate: '2027-02-01',
  });

  it('lists the dates to act on: asking to drop PMI, half paid, and free and clear', () => {
    const result = aResponse({
      baseline: loan(),
      accelerated: loan(),
      savings: aSavings({ acceleratedPayoffDate: '2027-04-01', originalPayoffDate: '2027-04-01', paymentsSaved: 0 }),
      pmiOtherChoice: { removal: 'Automatic', endDate: '2027-09-01', savedByAsking: 6_766 } as never,
    });

    expect(milestones(result)).toEqual([
      { id: 'pmi', title: 'Ask to drop PMI', detail: 'Saves $6,766 against waiting for it to come off by itself', date: '2027-02-01' },
      { id: 'half', title: 'Half paid', detail: 'What you own passes what you owe', date: '2027-02-01' },
      { id: 'paid', title: 'Free and clear', detail: 'The last payment', date: '2027-04-01' },
    ]);
  });

  it('says how much sooner the loan is paid off, when extra payments move it', () => {
    const result = aResponse({ baseline: loan(), accelerated: loan(), savings: aSavings({ acceleratedPayoffDate: '2027-04-01', paymentsSaved: 69 }) });

    expect(milestones(result).at(-1)!.detail).toBe('5 yr 9 mo sooner than scheduled');
  });

  it('leaves out the PMI date when there is nothing to ask for', () => {
    const result = aResponse({ baseline: loan(), accelerated: { ...loan(), mortgageInsuranceEndDate: null } });

    expect(milestones(result).map((m) => m.id)).toEqual(['half', 'paid']);
  });
});

describe('icsCalendar', () => {
  it('writes each date as an all-day event a calendar can import', () => {
    const ics = icsCalendar([{ id: 'paid', title: 'Free and clear', detail: 'The last payment', date: '2051-01-01' }], 'MA');

    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mortgage Analytics//Key dates//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'UID:paid-20510101@MA', 'DTSTAMP:20510101T000000Z', 'DTSTART;VALUE=DATE:20510101',
      'SUMMARY:Free and clear', 'DESCRIPTION:The last payment', 'END:VEVENT', 'END:VCALENDAR', '',
    ]);
  });

  it('escapes the characters the format reserves', () => {
    const ics = icsCalendar([{ id: 'paid' as const, title: 'Pay; then, rest', detail: 'a\\b', date: '2030-05-01' }], 'MA');

    expect(ics).toContain('SUMMARY:Pay\\; then\\, rest');
    expect(ics).toContain('DESCRIPTION:a\\\\b');
  });
});
