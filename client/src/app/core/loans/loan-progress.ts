/**
 * The arithmetic of a loan that is already being paid (shared by the calculator and the refinance page): how many payments are behind it, what is owed now, and,
 * working backwards, what was first borrowed. Standard annuity formulas; the API's schedule rounds interest to
 * the cent each month, so its balance can differ from these by a few cents.
 */

import { t } from '../i18n/i18n';

/**
 * Payments already made on a loan whose first payment was due on `firstPayment` (yyyy-MM-dd), as of `today`:
 * every due date before today. A payment due today counts as not yet made. 0 for a loan that has not started.
 */
export function paymentsMade(firstPayment: string | null | undefined, today: Date): number {
  if (!firstPayment) return 0;
  const [year, month, day] = firstPayment.split('-').map(Number);
  const months = (today.getFullYear() - year) * 12 + (today.getMonth() + 1 - month);
  const made = today.getDate() > day ? months + 1 : months;
  return Math.max(0, made);
}

/** The level monthly payment that repays `amount` at `annualRate` percent over `termMonths`, to the cent. */
export function monthlyPayment(amount: number, annualRate: number, termMonths: number): number {
  if (amount <= 0 || termMonths <= 0) return 0;
  const r = annualRate / 1200;
  const payment = r === 0 ? amount / termMonths : (amount * r) / (1 - (1 + r) ** -termMonths);
  return Math.round(payment * 100) / 100;
}

/**
 * What paying half of each month's payment every two weeks adds to each month. Twenty-six half payments are thirteen
 * whole ones a year, so it is one extra payment a year: a twelfth of the payment, spread over the months, to the cent.
 */
export function biweeklyExtra(payment: number): number {
  return Math.round((payment / 12) * 100) / 100;
}

/** What is owed after `made` of `termMonths` equal payments on `amount` borrowed at `annualRate` percent. */
export function balanceAfter(amount: number, annualRate: number, termMonths: number, made: number): number {
  if (made <= 0) return amount;
  if (made >= termMonths) return 0;
  const r = annualRate / 1200;
  if (r === 0) return (amount * (termMonths - made)) / termMonths;
  const total = (1 + r) ** termMonths;
  return (amount * (total - (1 + r) ** made)) / (total - 1);
}

/** What was first borrowed, given what is owed after `made` of `termMonths` payments: the reverse of balanceAfter. */
export function originalAmount(balance: number, annualRate: number, termMonths: number, made: number): number {
  if (made <= 0) return balance;
  const r = annualRate / 1200;
  if (r === 0) return (balance * termMonths) / (termMonths - made);
  const total = (1 + r) ** termMonths;
  return (balance * (total - 1)) / (total - (1 + r) ** made);
}

/** A loan as it stands today: payments made, what is owed, payments left, and the home's value now. */
export interface LoanToday {
  made: number;
  balance: number;
  monthsLeft: number;
  homeValue: number;
}

/**
 * Where a loan described by its purchase (price, down payment, rate, term and first payment) stands today. The
 * home's value grows from the price by the yearly growth rate, once for each full year since the first payment.
 */
export function loanToday(
  loan: { homePrice: number; downPayment: number; annualInterestRate: number; termInMonths: number; firstPaymentDate: string | null; homeValueGrowthRate?: number },
  today: Date,
): LoanToday {
  const made = Math.min(paymentsMade(loan.firstPaymentDate, today), loan.termInMonths);
  const growth = 1 + (loan.homeValueGrowthRate ?? 0) / 100;
  return {
    made,
    balance: toCents(balanceAfter(loan.homePrice - loan.downPayment, loan.annualInterestRate, loan.termInMonths, made)),
    monthsLeft: loan.termInMonths - made,
    homeValue: toCents(loan.homePrice * growth ** Math.floor(made / 12)),
  };
}

/** Shown when a loan's first payment is so long ago that the whole term is behind it. */
export const paidOffAlready = () => t('With that first payment, the whole term is already behind you: pick a later date or a longer term.');

/**
 * The first of the month `months` after the first of next month (before it, when negative), as yyyy-MM-dd. With 0,
 * the first of next month: the API's default first payment date.
 */
export function firstOfMonthFromNext(months: number, today = new Date()): string {
  const date = new Date(today.getFullYear(), today.getMonth() + 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Rounds to cents, the way the API stores amounts. */
export const toCents = (value: number) => Math.round(value * 100) / 100;
