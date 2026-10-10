/**
 * The arithmetic of a loan that is already being paid: how many payments are behind it, what is owed now, and,
 * working backwards, what was first borrowed. Standard annuity formulas; the API's schedule rounds interest to
 * the cent each month, so its balance can differ from these by a few cents.
 */

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

/** Rounds to cents, the way the API stores amounts. */
export const toCents = (value: number) => Math.round(value * 100) / 100;
