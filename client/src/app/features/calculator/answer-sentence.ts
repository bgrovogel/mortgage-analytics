import { usd } from '../../core/formatting/format';
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

/**
 * The answer a buyer came for, in a sentence under the page's question: what each month costs and what it is made of,
 * what it takes to close, and what paying extra does. The same figures as the tiles, said the way someone would say them.
 */
export function answerSentence(result: AmortizationResponse, due: Payment | null): string {
  const firstYear = result.buydown?.years[0];
  const housing = due ? due.housingCosts : result.baseline.monthlyHousingCosts.total;
  const loan = due ? due.scheduledPayment : (firstYear?.monthlyPayment ?? result.baseline.monthlyPayment);
  const total = due ? due.scheduledPayment + due.housingCosts : firstYear ? firstYear.monthlyPayment + housing : result.baseline.totalMonthlyPayment;

  const made = housing > 0
    ? `: ${usd(loan)} for the loan and ${usd(housing)} for taxes, insurance and the rest.`
    : `, all of it for the loan.`;
  const sentences = [`Your payment is ${usd(total)} a month${firstYear ? ' in year 1' : ''}${made}`];

  if (result.cashToClose) sentences.push(`You would bring ${usd(result.cashToClose.total)} to closing.`);

  const saved = result.savings;
  if (saved.paymentsSaved > 0 && saved.netSavings > 0) {
    sentences.push(`Paying extra pays it off ${inWords(saved.paymentsSaved)} sooner and saves ${usd(saved.netSavings)}.`);
  }
  return sentences.join(' ');
}
