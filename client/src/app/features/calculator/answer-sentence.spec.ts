import { aHousingCosts, aPayment, aResponse, aSavings, aSchedule } from '../../../testing/builders';
import { Affordability, RentOrBuyComparison } from '../../core/models/amortization.models';
import { answerSentence, nextPayment, paymentLead, viewAnswer } from './answer-sentence';

describe('the answer in a sentence', () => {
  /** The default example: $2,325.26 of principal and interest, $776.93 more of taxes, insurance, PMI and dues. */
  const example = (overrides: Parameters<typeof aResponse>[0] = {}) => aResponse({
    baseline: aSchedule({ monthlyPayment: 2_325.26, totalMonthlyPayment: 3_102.19, monthlyHousingCosts: aHousingCosts({ total: 776.93 }) }),
    savings: aSavings({ netSavings: 0, paymentsSaved: 0 }),
    ...overrides,
  });

  it('says what the monthly payment is made of', () => {
    expect(answerSentence(example(), null)).toBe('$2,325 goes to the loan and $777 to taxes, insurance and the rest.');
  });

  it('leaves out the rest when the loan is all there is to pay', () => {
    const bare = example({ baseline: aSchedule({ monthlyPayment: 2_325.26, totalMonthlyPayment: 2_325.26, monthlyHousingCosts: aHousingCosts({ total: 0 }) }) });

    expect(answerSentence(bare, null)).toBe('All of it goes to the loan.');
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

    expect(answerSentence(buydown, null)).toBe('$1,700 goes to the loan and $777 to taxes, insurance and the rest.');
    expect(paymentLead(buydown, null)).toBe('$2,477 a month in year 1');
  });

  it('counts the payment due next on a loan already being paid', () => {
    const due = aPayment(61, { scheduledPayment: 2_325.26, housingCosts: 928.94 });

    expect(paymentLead(example(), due)).toBe('$3,254 a month');
    expect(answerSentence(example(), due)).toContain('$2,325 goes to the loan and $929 to taxes');
  });

  describe('the lead', () => {
    it('is the monthly payment', () => {
      expect(paymentLead(example(), null)).toBe('$3,102 a month');
    });
  });

  describe('viewAnswer', () => {
    const affordability = (comfortableFits: boolean, mostFits: boolean) => ({
      monthlyIncome: 12_500, monthlyDebts: 600, housingPayment: 3_102.19, housingPercent: 24.82, totalPercent: 29.62,
      comfortable: { housingPercent: 28, totalPercent: 36, maxHousingPayment: 3_500, maxHomePrice: 474_091, fits: comfortableFits },
      mostAllowed: { housingPercent: null, totalPercent: 45, maxHousingPayment: 5_025, maxHomePrice: 700_615, fits: mostFits },
    } as Affordability);
    const rentOrBuy = (breakEvenYear: number | null, advantage = 91_429) => ({
      monthlyRent: 2_700, cashToClose: 48_128.79, breakEvenYear,
      years: [{ year: 1, advantage: -27_228 }, { year: 30, advantage }],
    } as unknown as RentOrBuyComparison);

    it('asks what the home costs on every view under Cost, with the payment as the answer', () => {
      for (const view of ['overview', 'closing', 'projection', 'schedule']) {
        const answer = viewAnswer(example(), view, null);

        expect([answer.heading, answer.lead]).toEqual(['What will this home cost?', '$3,102 a month']);
        expect(answer.detail).toBe('$2,325 goes to the loan and $777 to taxes, insurance and the rest.');
      }
    });

    it('answers "can you afford it" yes, comfortably, within the comfortable limits', () => {
      const answer = viewAnswer(example({ affordability: affordability(true, true) }), 'affordability', null);

      expect(answer.heading).toBe('Can you afford it?');
      expect(answer.lead).toBe('Yes, comfortably');
      expect(answer.detail).toBe(
        '$3,102 a month is 24.82% of your $12,500 monthly income, and 29.62% with your $600 of other debts. You could spend up to $474,091 and stay within the comfortable limits.');
    });

    it('answers yes, but a stretch, past the comfortable limits and within the most the loan allows', () => {
      const answer = viewAnswer(example({ affordability: affordability(false, true) }), 'affordability', null);

      expect(answer.lead).toBe('Yes, but a stretch');
      expect(answer.detail).toContain('past the comfortable limits');
      expect(answer.detail).toContain('up to $700,615');
    });

    it('answers no, past what a lender allows', () => {
      const answer = viewAnswer(example({ affordability: affordability(false, false) }), 'affordability', null);

      expect(answer.lead).toBe('Not at this income');
      expect(answer.detail).toContain('past what a lender would allow');
    });

    it('asks for an income before answering whether it can be afforded', () => {
      const answer = viewAnswer(example(), 'affordability', null);

      expect([answer.lead, answer.detail]).toEqual([null, 'Add your household’s income and debts to see whether this home fits and the most you could pay.']);
    });

    describe('starting from a budget', () => {
      it('leads with the most that can be bought comfortably, whatever home is in the form', () => {
        const answer = viewAnswer(example({ affordability: affordability(true, true) }), 'affordability', null, 'budget');

        expect(answer.heading).toBe('How much house can you afford?');
        expect(answer.lead).toBe('$474,091 comfortably');
        expect(answer.detail).toBe(
          'Housing can be $3,500 a month, 28% of your $12,500 monthly income, and 36% once your $600 of debts is counted. A lender may stretch to $700,615.');
      });

      it('says when the debts leave no room at the comfortable limits', () => {
        const none = affordability(false, true);
        none.comfortable.maxHomePrice = 0;
        const answer = viewAnswer(example({ affordability: none }), 'affordability', null, 'budget');

        expect(answer.lead).toBe('Not comfortably');
        expect(answer.detail).toContain('$700,615');
      });

      it('answers from a monthly budget when there is no income', () => {
        const answer = viewAnswer(example({ budget: { monthlyBudget: 3_000, maxHomePrice: 412_345, downPayment: 37_111.05 } }), 'affordability', null, 'budget');

        expect(answer.lead).toBe('$412,345 for $3,000 a month');
        expect(answer.detail).toBe('That keeps your down payment share of 20%: $37,111 down, with taxes and insurance counted in the payment.');
      });

      it('asks for an income, debts or a monthly budget before answering', () => {
        const answer = viewAnswer(example(), 'affordability', null, 'budget');

        expect([answer.lead, answer.detail]).toEqual([null, 'Add your household’s income and debts, or what you want to pay a month, to see the most you could buy.']);
      });

      it('leaves the other views alone', () => {
        expect(viewAnswer(example(), 'overview', null, 'budget').lead).toBe('$3,102 a month');
      });
    });

    it('answers rent or buy with how long to stay', () => {
      const answer = viewAnswer(example({ rentOrBuy: rentOrBuy(4) }), 'rent-or-buy', null);

      expect(answer.heading).toBe('Should you rent or buy?');
      expect(answer.lead).toBe('Buy, if you stay 4 years or more');
      expect(answer.detail).toBe(
        'Against renting a similar home at $2,700 a month, buying comes out ahead from year 4. Before that, renting leaves you better off: you pay $48,129 to close that a renter invests instead.');
    });

    it('says buying is ahead from the first year', () => {
      expect(viewAnswer(example({ rentOrBuy: rentOrBuy(1) }), 'rent-or-buy', null).lead).toBe('Buy, from the first year');
    });

    it('says renting stays ahead when buying never catches up', () => {
      const answer = viewAnswer(example({ rentOrBuy: rentOrBuy(null, -50_000) }), 'rent-or-buy', null);

      expect(answer.lead).toBe('Rent: it stays ahead for all 2 years');
      expect(answer.detail).toContain('renting leaves you $50,000 better off');
    });

    it('asks for a rent before answering rent or buy', () => {
      const answer = viewAnswer(example(), 'rent-or-buy', null);

      expect([answer.lead, answer.detail]).toEqual([null, 'Enter the rent for a similar home to see when buying comes out ahead.']);
    });
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
