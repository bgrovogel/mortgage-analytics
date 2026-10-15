import { aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { balanceFrames, balanceSeries, pathThrough, resample } from './balance-series';

/** A schedule that pays $100 of principal a month on a $1,000 balance, by default. */
const schedule = (months: number, perMonth = 100, extra = 0) => aSchedule({
  payments: Array.from({ length: months }, (_, i) => aPayment(i + 1, {
    principal: perMonth, extraPrincipal: extra, interest: 10, remainingBalance: Math.max(0, 1_000 - (i + 1) * (perMonth + extra)),
  })),
});

describe('balanceSeries', () => {
  it('starts from the balance before the first payment, and ends at zero', () => {
    const series = balanceSeries(aResponse({ baseline: schedule(10), accelerated: schedule(10) }));

    expect(series.scheduled).toHaveLength(11);
    expect([series.scheduled[0], series.scheduled[1], series.scheduled[10]]).toEqual([1_000, 900, 0]);
  });

  it('keeps the accelerated balance at zero once the loan is paid off, so both curves have one length', () => {
    const series = balanceSeries(aResponse({ baseline: schedule(10), accelerated: schedule(5, 100, 100) }));

    expect(series.extra).toHaveLength(11);
    expect(series.extra.slice(4)).toEqual([200, 0, 0, 0, 0, 0, 0]);
    expect(series.payoffMonth).toBe(5);
    expect(series.hasExtra).toBe(true);
  });

  it('says there is no extra when the two schedules are the same', () => {
    const series = balanceSeries(aResponse({ baseline: schedule(10), accelerated: schedule(10) }));

    expect(series.hasExtra).toBe(false);
  });

  it('adds up the interest paid so far, with extra payments', () => {
    const series = balanceSeries(aResponse({ baseline: schedule(10), accelerated: schedule(5, 100, 100) }));

    expect(series.interest.slice(0, 4)).toEqual([0, 10, 20, 30]);
    expect(series.interest[5]).toBe(50);
    expect(series.interest[10]).toBe(50); // none after the loan is paid
  });

  it('starts a loan already being paid from what was owed before its first payment on the schedule', () => {
    const baseline = aSchedule({ payments: [aPayment(61, { principal: 300, extraPrincipal: 0, remainingBalance: 700 }), aPayment(62, { principal: 700, remainingBalance: 0 })] });
    const series = balanceSeries(aResponse({ baseline, accelerated: baseline }));

    expect(series.scheduled).toEqual([1_000, 700, 0]);
  });
});

describe('balanceFrames', () => {
  const frames = (months: number, payoff: number) => balanceFrames(months, payoff).map((f) => [f.value, f.label, f.months]);

  it('offers five years, ten, the loan to its payoff, and the full term', () => {
    expect(frames(360, 291)).toEqual([['5y', '5Y', 60], ['10y', '10Y', 120], ['payoff', 'To payoff', 291], ['all', '30Y', 360]]);
  });

  it('leaves out "to payoff" when nothing extra moves it, and any frame as long as the loan', () => {
    expect(frames(360, 360)).toEqual([['5y', '5Y', 60], ['10y', '10Y', 120], ['all', '30Y', 360]]);
    expect(frames(120, 120)).toEqual([['5y', '5Y', 60], ['all', '10Y', 120]]);
  });

  it('calls a term that is not whole years the full term', () => {
    expect(frames(350, 350).at(-1)).toEqual(['all', 'Full term', 350]);
  });
});

describe('resample', () => {
  it('reads a curve at evenly spaced points across a span of months, between months too', () => {
    expect(resample([1_000, 800, 600, 400, 200, 0], 4, 3)).toEqual([1_000, 600, 200]);
    expect(resample([1_000, 800, 600, 400, 200, 0], 5, 3)).toEqual([1_000, 500, 0]);
  });
});

describe('pathThrough', () => {
  it('draws a line across the width, higher for a bigger balance', () => {
    expect(pathThrough([100, 50, 0], 100, 200, 100)).toBe('M0 0L50 100L100 200');
  });
});
