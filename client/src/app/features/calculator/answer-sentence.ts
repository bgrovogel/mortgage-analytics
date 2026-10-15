import { decimal, usd } from '../../core/formatting/format';
import { paymentsMade } from '../../core/loans/loan-progress';
import { AmortizationResponse, Payment } from '../../core/models/amortization.models';

/**
 * On a loan already being paid (its first payment behind `today`), the payment due next, the one the form counts from;
 * null for a new loan, or one already paid off.
 */
export function nextPayment(result: AmortizationResponse, today: Date = new Date()): Payment | null {
  const payments = result.baseline.payments;
  const made = paymentsMade(payments[0]?.dueDate, today);
  return made > 0 && made < payments.length ? payments[made] : null;
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;

/** 69 months is "5 years 9 months". */
function inWords(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return [years > 0 ? plural(years, 'year') : '', months > 0 ? plural(months, 'month') : ''].filter(Boolean).join(' ');
}

/** What each month is made of: the loan's principal and interest, and everything else paid with it. */
function monthlyParts(result: AmortizationResponse, due: Payment | null) {
  const firstYear = result.buydown?.years[0];
  const housing = due ? due.housingCosts : result.baseline.monthlyHousingCosts.total;
  const loan = due ? due.scheduledPayment : (firstYear?.monthlyPayment ?? result.baseline.monthlyPayment);
  const total = due ? due.scheduledPayment + due.housingCosts : firstYear ? firstYear.monthlyPayment + housing : result.baseline.totalMonthlyPayment;
  return { housing, loan, total, inYearOne: !!firstYear && !due };
}

/** The monthly payment, the answer to what the home costs: "$3,102 a month", "in year 1" with a buydown. */
export function paymentLead(result: AmortizationResponse, due: Payment | null): string {
  const { total, inYearOne } = monthlyParts(result, due);
  return `${usd(total)} a month${inYearOne ? ' in year 1' : ''}`;
}

/**
 * Under the payment, in a sentence or two: what it is made of, what it takes to close, and what paying extra does.
 * The same figures as the tiles, said the way someone would say them.
 */
export function answerSentence(result: AmortizationResponse, due: Payment | null): string {
  const { housing, loan } = monthlyParts(result, due);
  const sentences = [housing > 0 ? `${usd(loan)} goes to the loan and ${usd(housing)} to taxes, insurance and the rest.` : 'All of it goes to the loan.'];

  if (result.cashToClose) sentences.push(`You would bring ${usd(result.cashToClose.total)} to closing.`);

  const saved = result.savings;
  if (saved.paymentsSaved > 0 && saved.netSavings > 0) {
    sentences.push(`Paying extra pays it off ${inWords(saved.paymentsSaved)} sooner and saves ${usd(saved.netSavings)}.`);
  }
  return sentences.join(' ');
}

/** What a view of buying a home asks, the answer in a line, and a sentence or two behind it. */
export interface ViewAnswer {
  /** The question the view answers. */
  heading: string;
  /** The answer, in a line; null while the view still needs something from the buyer. */
  lead: string | null;
  /** What stands behind it, or what to enter to get one. */
  detail: string;
}

/** The answer a view of buying a home leads with: what it costs, whether it can be afforded, or rent against buy. */
export function viewAnswer(result: AmortizationResponse, view: string, due: Payment | null): ViewAnswer {
  if (view === 'affordability') return affordAnswer(result);
  if (view === 'rent-or-buy') return rentAnswer(result);
  return { heading: 'What will this home cost?', lead: paymentLead(result, due), detail: answerSentence(result, due) };
}

function affordAnswer(result: AmortizationResponse): ViewAnswer {
  const heading = 'Can you afford it?';
  const a = result.affordability;
  if (!a) {
    return { heading, lead: null, detail: 'Add your household’s income and debts to see whether this home fits and the most you could pay.' };
  }
  const share = `${usd(a.housingPayment)} a month is ${decimal(a.housingPercent)}% of your ${usd(a.monthlyIncome)} monthly income`
    + (a.monthlyDebts > 0 ? `, and ${decimal(a.totalPercent)}% with your ${usd(a.monthlyDebts)} of other debts.` : '.');
  if (a.comfortable.fits) {
    return { heading, lead: 'Yes, comfortably', detail: `${share} You could spend up to ${usd(a.comfortable.maxHomePrice)} and stay within the comfortable limits.` };
  }
  if (a.mostAllowed.fits) {
    return {
      heading, lead: 'Yes, but a stretch',
      detail: `${share} That is past the comfortable limits; a lender would go up to ${usd(a.mostAllowed.maxHomePrice)}.`,
    };
  }
  return {
    heading, lead: 'Not at this income',
    detail: `${share} That is past what a lender would allow; the most it reaches is ${usd(a.mostAllowed.maxHomePrice)}.`,
  };
}

function rentAnswer(result: AmortizationResponse): ViewAnswer {
  const heading = 'Should you rent or buy?';
  const c = result.rentOrBuy;
  if (!c) return { heading, lead: null, detail: 'Enter the rent for a similar home to see when buying comes out ahead.' };

  const against = `Against renting a similar home at ${usd(c.monthlyRent)} a month,`;
  if (c.breakEvenYear === 1) {
    return { heading, lead: 'Buy, from the first year', detail: `${against} buying comes out ahead from the first year.` };
  }
  if (c.breakEvenYear !== null) {
    return {
      heading, lead: `Buy, if you stay ${c.breakEvenYear} years or more`,
      detail: `${against} buying comes out ahead from year ${c.breakEvenYear}. Before that, renting leaves you better off: you pay ${usd(c.cashToClose)} to close that a renter invests instead.`,
    };
  }
  const last = c.years[c.years.length - 1];
  return {
    heading, lead: `Rent: it stays ahead for all ${c.years.length} years`,
    detail: `${against} renting leaves you ${usd(-last.advantage)} better off by year ${last.year}.`,
  };
}
