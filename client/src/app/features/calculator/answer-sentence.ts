import { decimal, usd, usdCents } from '../../core/formatting/format';
import { paymentsMade } from '../../core/loans/loan-progress';
import { AmortizationResponse, Payment } from '../../core/models/amortization.models';
import { t, tp } from '../../core/i18n/i18n';

/**
 * On a loan already being paid (its first payment behind `today`), the payment due next, the one the form counts from;
 * null for a new loan, or one already paid off.
 */
export function nextPayment(result: AmortizationResponse, today: Date = new Date()): Payment | null {
  const payments = result.baseline.payments;
  const made = paymentsMade(payments[0]?.dueDate, today);
  return made > 0 && made < payments.length ? payments[made] : null;
}

/** 69 months is "5 years 9 months". */
function inWords(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return t('{0} {1}', [tp(years, '{n} year', '{n} years'), tp(months, '{n} month', '{n} months')]);
  return years > 0 ? tp(years, '{n} year', '{n} years') : tp(months, '{n} month', '{n} months');
}

/** What each month is made of: the loan's principal and interest, and everything else paid with it. */
function monthlyParts(result: AmortizationResponse, due: Payment | null) {
  const firstYear = result.buydown?.years[0];
  const housing = due ? due.housingCosts : result.baseline.monthlyHousingCosts.total;
  const loan = due ? due.scheduledPayment : (firstYear?.monthlyPayment ?? result.baseline.monthlyPayment);
  const total = due ? due.scheduledPayment + due.housingCosts : firstYear ? firstYear.monthlyPayment + housing : result.baseline.totalMonthlyPayment;
  return { housing, loan, total, inYearOne: !!firstYear && !due };
}

/** The monthly payment, the answer to what the home costs, to the cent: "$3,102.19 a month", "in year 1" with a buydown. */
export function paymentLead(result: AmortizationResponse, due: Payment | null): string {
  const { total, inYearOne } = monthlyParts(result, due);
  return inYearOne ? t('{0} a month in year 1', [usdCents(total)]) : t('{0} a month', [usdCents(total)]);
}

/**
 * Under the payment, in a sentence or two: what it is made of, what it takes to close, and what paying extra does.
 * The same figures as the tiles, said the way someone would say them.
 */
export function answerSentence(result: AmortizationResponse, due: Payment | null): string {
  const { housing, loan } = monthlyParts(result, due);
  const sentences = [housing > 0 ? t('{0} goes to the loan and {1} to taxes, insurance and the rest.', [usd(loan), usd(housing)]) : t('All of it goes to the loan.')];

  if (result.cashToClose) sentences.push(t('You would bring {0} to closing.', [usd(result.cashToClose.total)]));

  const saved = result.savings;
  if (saved.paymentsSaved > 0 && saved.netSavings > 0) {
    sentences.push(t('Paying extra pays it off {0} sooner and saves {1}.', [inWords(saved.paymentsSaved), usd(saved.netSavings)]));
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
export function viewAnswer(result: AmortizationResponse, view: string, due: Payment | null, start: AffordStart = 'home'): ViewAnswer {
  if (view === 'affordability') return start === 'budget' ? budgetAnswer(result) : affordAnswer(result);
  if (view === 'rent-or-buy') return rentAnswer(result);
  return { heading: t('What will this home cost?'), lead: paymentLead(result, due), detail: answerSentence(result, due) };
}

/** What the affordability question starts from: a home in mind, or the budget (the most that could be bought). */
export type AffordStart = 'home' | 'budget';

/** "How much house can you afford?": the most that can be bought, from the income and debts or from a monthly budget. */
function budgetAnswer(result: AmortizationResponse): ViewAnswer {
  const heading = t('How much house can you afford?');
  const a = result.affordability;
  if (a) {
    const stretch = a.mostAllowed.maxHomePrice > 0 ? t('A lender may stretch to {0}.', [usd(a.mostAllowed.maxHomePrice)]) : '';
    if (a.comfortable.maxHomePrice <= 0) {
      return { heading, lead: t('Not comfortably'), detail: [t('Your debts leave no room at the comfortable limits.'), stretch].filter(Boolean).join(' ') };
    }
    const housing = t('Housing can be {0} a month, {1}% of your {2} monthly income, and {3}% once your {4} of debts is counted.', [
      usd(a.comfortable.maxHousingPayment), decimal(a.comfortable.housingPercent ?? 0), usd(a.monthlyIncome), decimal(a.comfortable.totalPercent), usd(a.monthlyDebts),
    ]);
    return { heading, lead: t('{0} comfortably', [usd(a.comfortable.maxHomePrice)]), detail: [housing, stretch].filter(Boolean).join(' ') };
  }
  const b = result.budget;
  if (b && b.maxHomePrice > 0) {
    return {
      heading, lead: t('{0} for {1} a month', [usd(b.maxHomePrice), usd(b.monthlyBudget)]),
      detail: t('That keeps your down payment share of {0}%: {1} down, with taxes and insurance counted in the payment.', [decimal(result.purchase.downPaymentPercent, 1), usd(b.downPayment)]),
    };
  }
  return { heading, lead: null, detail: t('Add your household’s income and debts, or what you want to pay a month, to see the most you could buy.') };
}

function affordAnswer(result: AmortizationResponse): ViewAnswer {
  const heading = t('Can you afford it?');
  const a = result.affordability;
  if (!a) {
    return { heading, lead: null, detail: t('Add your household’s income and debts to see whether this home fits and the most you could pay.') };
  }
  const share = a.monthlyDebts > 0
    ? t('{0} a month is {1}% of your {2} monthly income, and {3}% with your {4} of other debts.', [usd(a.housingPayment), decimal(a.housingPercent), usd(a.monthlyIncome), decimal(a.totalPercent), usd(a.monthlyDebts)])
    : t('{0} a month is {1}% of your {2} monthly income.', [usd(a.housingPayment), decimal(a.housingPercent), usd(a.monthlyIncome)]);
  if (a.comfortable.fits) {
    return { heading, lead: t('Yes, comfortably'), detail: `${share} ${t('You could spend up to {0} and stay within the comfortable limits.', [usd(a.comfortable.maxHomePrice)])}` };
  }
  if (a.mostAllowed.fits) {
    return {
      heading, lead: t('Yes, but a stretch'),
      detail: `${share} ${t('That is past the comfortable limits; a lender would go up to {0}.', [usd(a.mostAllowed.maxHomePrice)])}`,
    };
  }
  return {
    heading, lead: t('Not at this income'),
    detail: `${share} ${t('That is past what a lender would allow; the most it reaches is {0}.', [usd(a.mostAllowed.maxHomePrice)])}`,
  };
}

function rentAnswer(result: AmortizationResponse): ViewAnswer {
  const heading = t('Should you rent or buy?');
  const c = result.rentOrBuy;
  if (!c) return { heading, lead: null, detail: t('Enter the rent for a similar home to see when buying comes out ahead.') };

  const rent = usd(c.monthlyRent);
  if (c.breakEvenYear === 1) {
    return { heading, lead: t('Buy, from the first year'), detail: t('Against renting a similar home at {0} a month, buying comes out ahead from the first year.', [rent]) };
  }
  if (c.breakEvenYear !== null) {
    return {
      heading, lead: t('Buy, if you stay {0} years or more', [c.breakEvenYear]),
      detail: t('Against renting a similar home at {0} a month, buying comes out ahead from year {1}. Before that, renting leaves you better off: you pay {2} to close that a renter invests instead.', [rent, c.breakEvenYear, usd(c.cashToClose)]),
    };
  }
  const last = c.years[c.years.length - 1];
  return {
    heading, lead: t('Rent: it stays ahead for all {0} years', [c.years.length]),
    detail: t('Against renting a similar home at {0} a month, renting leaves you {1} better off by year {2}.', [rent, usd(-last.advantage), last.year]),
  };
}
