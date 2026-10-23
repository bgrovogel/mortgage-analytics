import { Language, currentLanguage } from '../i18n/i18n';

// The app's number and date formats, defined once so every page writes money, rates and months the same way.
// Numbers read the same in US English and US Spanish (1,234.56), so only the names of months follow the language.

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollarsOrCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const compactDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const monthYears = new Map<Language, Intl.DateTimeFormat>();
const decimals = new Map<number, Intl.NumberFormat>();

/** "$1,234": whole dollars. */
export const usd = (value: number) => dollars.format(value);

/** "$1,234.56": dollars and cents. */
export const usdCents = (value: number) => cents.format(value);

/** "$1,500" for whole dollars, "$1,798.65" or "$1,562.50" otherwise: cents, when there are any, always two digits. */
export const money = (value: number) => (Number.isInteger(Math.round(value * 100) / 100) ? dollarsOrCents.format(value) : cents.format(value));

/** "$1.2M": for chart axes ("$1.2 M" and "$90 mil" in Spanish). */
export function compactUsd(value: number): string {
  const text = compactDollars.format(value).replace(/\.0(?=[KMBT]?$)/, '');
  return currentLanguage() === 'es' ? text.replace(/K$/, ' mil').replace(/M$/, ' M') : text;
}

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

/** The names of months, years and days in the page's language: "en-US" or "es-US". */
export const dateLocale = (): string => (currentLanguage() === 'es' ? 'es-US' : 'en-US');

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** A moment written in the page's language, with the options of `Intl.DateTimeFormat`: "Oct 14, 2026" ("14 oct 2026" in Spanish). */
export function dateText(date: Date, options: Intl.DateTimeFormatOptions): string {
  const locale = dateLocale();
  const key = `${locale} ${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format.format(date);
}

/** "Sep 2033" ("sep 2033" in Spanish), from a yyyy-MM-dd date. */
export function monthOf(isoDate: string): string {
  const language = currentLanguage();
  let format = monthYears.get(language);
  if (!format) {
    format = new Intl.DateTimeFormat(dateLocale(), { month: 'short', year: 'numeric', timeZone: 'UTC' });
    monthYears.set(language, format);
  }
  return format.format(new Date(`${isoDate}T00:00:00Z`));
}
