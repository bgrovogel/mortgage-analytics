// The app's number and date formats, defined once so every page writes money, rates and months the same way.

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollarsOrCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const compactDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const decimals = new Map<number, Intl.NumberFormat>();

/** "$1,234": whole dollars. */
export const usd = (value: number) => dollars.format(value);

/** "$1,234.56": dollars and cents. */
export const usdCents = (value: number) => cents.format(value);

/** "$1,500" for whole dollars, "$1,798.65" otherwise. */
export const money = (value: number) => dollarsOrCents.format(value);

/** "$1.2M": for chart axes. */
export const compactUsd = (value: number) => compactDollars.format(value);

/** "+$1,234", "−$1,234" or "$0": a difference. */
export const signedUsd = (value: number) => (Math.round(value) === 0 ? '$0' : `${value > 0 ? '+' : '−'}${dollars.format(Math.abs(value))}`);

/** "375,000" or "6.25": a plain number with up to `maxDecimals` decimal places. */
export function decimal(value: number, maxDecimals = 2): string {
  let format = decimals.get(maxDecimals);
  if (!format) {
    format = new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDecimals });
    decimals.set(maxDecimals, format);
  }
  return format.format(value);
}

/** "6.5%". */
export const pct = (value: number, maxDecimals = 2) => `${decimal(value, maxDecimals)}%`;

/** "+4%", "-2%" or "0%": a yearly change. */
export const signedPct = (value: number, maxDecimals = 2) => `${value > 0 ? '+' : ''}${pct(value, maxDecimals)}`;

/** "Sep 2033", from a yyyy-MM-dd date. */
export const monthOf = (isoDate: string) => monthYear.format(new Date(`${isoDate}T00:00:00Z`));
