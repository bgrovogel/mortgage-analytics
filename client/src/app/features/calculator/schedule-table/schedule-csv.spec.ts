import { ScheduleColumn, ScheduleRow } from './schedule-model';
import { scheduleCsv } from './schedule-csv';

describe('scheduleCsv', () => {
  const row = (number: number, when: string, overrides: Partial<ScheduleRow> = {}): ScheduleRow => ({
    number, when, scheduledPayment: 2_325.26, principal: 358.33, interest: 1_966.93, extraPrincipal: 200, costs: {} as ScheduleRow['costs'],
    housingCosts: 776.93, totalOutlay: 3_302.19, remainingBalance: 377_091.67, pmiEnds: false, recast: false, ...overrides,
  });
  const columns: ScheduleColumn[] = [
    { key: 'principal', label: 'Principal', value: (r) => r.principal },
    { key: 'interest', label: 'Interest', value: (r) => r.interest },
    { key: 'totalOutlay', label: 'Total', value: (r) => r.totalOutlay },
  ];

  it('has a header, then a line for each row, with plain numbers a spreadsheet can add up', () => {
    const csv = scheduleCsv([row(1, 'Nov 2026'), row(2, 'Dec 2026', { remainingBalance: 376_530.43 })], columns, 'monthly');

    expect(csv.split('\r\n')).toEqual([
      '#,Date,Payment,Principal,Interest,Total,Balance',
      '1,Nov 2026,2325.26,358.33,1966.93,3302.19,377091.67',
      '2,Dec 2026,2325.26,358.33,1966.93,3302.19,376530.43',
      '',
    ]);
  });

  it('heads a yearly schedule by year, and the year it starts in', () => {
    expect(scheduleCsv([row(1, '2026')], columns, 'yearly').split('\r\n')[0]).toBe('Year,Starts,Payment,Principal,Interest,Total,Balance');
  });

  it('writes amounts to the cent, and never in exponent form', () => {
    const csv = scheduleCsv([row(1, 'Nov 2026', { principal: 0.1 + 0.2, remainingBalance: 1e-7 })], columns, 'monthly');

    expect(csv.split('\r\n')[1]).toBe('1,Nov 2026,2325.26,0.30,1966.93,3302.19,0.00');
  });

  it('quotes a label with a comma or a quote, as CSV asks', () => {
    const odd: ScheduleColumn[] = [{ key: 'x', label: 'Tax, "county"', value: () => 1 }];

    expect(scheduleCsv([row(1, 'Nov 2026')], odd, 'monthly').split('\r\n')[0]).toBe('#,Date,Payment,"Tax, ""county""",Balance');
  });

  it('is only a header for no rows', () => {
    expect(scheduleCsv([], columns, 'monthly')).toBe('#,Date,Payment,Principal,Interest,Total,Balance\r\n');
  });
});
