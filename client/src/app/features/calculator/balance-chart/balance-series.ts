import { AmortizationResponse, Schedule } from '../../../core/models/amortization.models';
import { t } from '../../../core/i18n/i18n';

/** The balance, month by month, with and without extra payments, for the chart and its scrubber. Index 0 is the start. */
export interface BalanceSeries {
  /** The balance after each month on the standard schedule; index 0 is what was owed before the first payment. */
  scheduled: number[];
  /** The same with extra payments: zero from the month the loan is paid off, so both curves run the same length. */
  extra: number[];
  /** Interest paid so far, with extra payments, after each month. */
  interest: number[];
  /** The month the loan is paid off with extra payments (the standard term when nothing extra is paid). */
  payoffMonth: number;
  /** True when the two curves differ. */
  hasExtra: boolean;
}

/** What was owed before the schedule's first payment. */
const opening = (schedule: Schedule): number => {
  const first = schedule.payments[0];
  return first ? first.remainingBalance + first.principal + first.extraPrincipal : 0;
};

/** Reads the two balance curves out of a result. */
export function balanceSeries(result: AmortizationResponse): BalanceSeries {
  const { baseline, accelerated } = result;
  const months = baseline.payments.length;
  const start = opening(baseline);
  const scheduled = [start, ...baseline.payments.map((p) => p.remainingBalance)];
  const extra = [start, ...baseline.payments.map((_, i) => accelerated.payments[i]?.remainingBalance ?? 0)];
  let paid = 0;
  const interest = [0, ...baseline.payments.map((_, i) => (paid += accelerated.payments[i]?.interest ?? 0))];
  const hasExtra = scheduled.some((balance, i) => balance !== extra[i]);
  return { scheduled, extra, interest, payoffMonth: Math.min(months, accelerated.payments.length), hasExtra };
}

/** A time frame the chart can show. */
export interface BalanceFrame {
  value: string;
  label: string;
  /** How many months of the loan it spans. */
  months: number;
}

/** The frames worth offering: five years, ten, to payoff (when extra payments move it), and the full term. */
export function balanceFrames(termMonths: number, payoffMonth: number): BalanceFrame[] {
  const frames: BalanceFrame[] = [];
  if (termMonths > 60) frames.push({ value: '5y', label: t('{0}Y', [5]), months: 60 });
  if (termMonths > 120) frames.push({ value: '10y', label: t('{0}Y', [10]), months: 120 });
  if (payoffMonth < termMonths && payoffMonth > 0) frames.push({ value: 'payoff', label: t('To payoff'), months: payoffMonth });
  frames.push({ value: 'all', label: termMonths % 12 === 0 ? t('{0}Y', [termMonths / 12]) : t('Full term'), months: termMonths });
  return frames;
}

/** `count` values read at evenly spaced points across the first `months` months, between two months where need be. */
export function resample(values: readonly number[], months: number, count: number): number[] {
  const last = values.length - 1;
  return Array.from({ length: count }, (_, i) => {
    const at = Math.min(last, (i / Math.max(1, count - 1)) * months);
    const low = Math.floor(at);
    const high = Math.min(last, low + 1);
    return values[low] + (values[high] - values[low]) * (at - low);
  });
}

/** An SVG path through values drawn across `width`, the biggest balance at the top of `height`. */
export function pathThrough(values: readonly number[], width: number, height: number, max: number): string {
  const scale = max > 0 ? max : 1;
  return values
    .map((value, i) => {
      const x = (i / Math.max(1, values.length - 1)) * width;
      const y = height - (value / scale) * height;
      return `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
    })
    .join('');
}

const round = (n: number) => Math.round(n * 10) / 10;
