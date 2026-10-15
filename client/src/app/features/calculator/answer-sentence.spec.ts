import { aHousingCosts, aPayment, aResponse, aSavings, aSchedule } from '../../../testing/builders';
import { answerSentence, nextPayment } from './answer-sentence';

describe('the answer in a sentence', () => {
  /** The default example: $2,325.26 of principal and interest, $776.93 more of taxes, insurance, PMI and dues. */
  const example = (overrides: Parameters<typeof aResponse>[0] = {}) => aResponse({
    baseline: aSchedule({ monthlyPayment: 2_325.26, totalMonthlyPayment: 3_102.19, monthlyHousingCosts: aHousingCosts({ total: 776.93 }) }),
    savings: aSavings({ netSavings: 0, paymentsSaved: 0 }),
    ...overrides,
  });

  it('says the monthly payment, and what it is made of', () => {
    expect(answerSentence(example(), null)).toBe('Your payment is $3,102 a month: $2,325 for the loan and $777 for taxes, insurance and the rest.');
  });

  it('leaves out the rest when the loan is all there is to pay', () => {
    const bare = example({ baseline: aSchedule({ monthlyPayment: 2_325.26, totalMonthlyPayment: 2_325.26, monthlyHousingCosts: aHousingCosts({ total: 0 }) }) });

    expect(answerSentence(bare, null)).toBe('Your payment is $2,325 a month, all of it for the loan.');
  });

  it('adds what it takes to close', () => {
    const closing = example({ cashToClose: { downPayment: 37_350, closingCosts: 10_778.79, credits: 0, total: 48_128.79 } as never });

    expect(answerSentence(closing, null)).toContain(' You would bring $48,129 to closing.');
  });

  it('adds what paying extra does: how much sooner, and what it saves', () => {
    const extra = example({ savings: aSavings({ netSavings: 108_039, paymentsSaved: 69 }) });

    expect(answerSentence(extra, null)).toContain(' Paying extra pays it off 5 years 9 months sooner and saves $108,039.');
  });

  it('says a whole number of years, or one month, in the singular', () => {
    expect(answerSentence(example({ savings: aSavings({ netSavings: 5_000, paymentsSaved: 24 }) }), null)).toContain('pays it off 2 years sooner');
    expect(answerSentence(example({ savings: aSavings({ netSavings: 50, paymentsSaved: 1 }) }), null)).toContain('pays it off 1 month sooner');
  });

  it('says the first year of a buydown, since the payment rises after it', () => {
    const buydown = example({
      buydown: { noteRate: 6, years: [{ year: 1, annualInterestRate: 4, monthlyPayment: 1_700, subsidy: 5_000 }], totalSubsidy: 5_000, paidBy: 'Seller' as never },
    });

    expect(answerSentence(buydown, null)).toBe('Your payment is $2,477 a month in year 1: $1,700 for the loan and $777 for taxes, insurance and the rest.');
  });

  it('counts the payment due next on a loan already being paid', () => {
    const due = aPayment(61, { scheduledPayment: 2_325.26, housingCosts: 928.94 });

    expect(answerSentence(example(), due)).toContain('Your payment is $3,254 a month: $2,325 for the loan and $929 for taxes');
  });

  describe('nextPayment', () => {
    const payments = (firstDue: string) => aSchedule({
      payments: Array.from({ length: 3 }, (_, i) => aPayment(i + 1, { dueDate: firstDue.replace('-01-', `-0${i + 1}-`) })),
    });

    it('is the first payment not yet made on a loan that has started', () => {
      const started = aResponse({ baseline: payments('2020-01-15') }); // due Jan 15, Feb 15 and Mar 15
      expect(nextPayment(started, new Date(2020, 1, 20))?.paymentNumber).toBe(3); // two are behind it
    });

    it('is none for a loan that has not started, or one already paid off', () => {
      expect(nextPayment(aResponse({ baseline: payments('2036-01-15') }), new Date(2026, 5, 1))).toBeNull();
      expect(nextPayment(aResponse({ baseline: payments('2020-01-15') }), new Date(2026, 5, 1))).toBeNull();
    });
  });
});
