import { aResponse, aSchedule } from '../../../../testing/builders';
import { rateWhatIfLoan, whatIf } from './rate-what-if';

describe('rate what-if', () => {
  /** The reference loan: $200,000 at 6% over 30 years (tools/calculator-check). */
  const loan = { amount: 200_000, rate: 6, termMonths: 360 };

  describe('whatIf', () => {
    it('is the loan as it stands with no change', () => {
      expect(whatIf(loan, 0)).toEqual({ rate: 6, payment: 1_199.1, paymentChange: 0, interest: 231_676, interestChange: 0 });
    });

    it('prices a higher rate: the payment, and the interest over the loan', () => {
      expect(whatIf(loan, 0.5)).toEqual({ rate: 6.5, payment: 1_264.14, paymentChange: 65.04, interest: 255_090.4, interestChange: 23_414.4 });
    });

    it('prices a lower rate, as a saving', () => {
      const lower = whatIf(loan, -0.5);

      expect(lower.rate).toBe(5.5);
      expect(lower.paymentChange).toBeLessThan(0);
      expect(lower.interestChange).toBeLessThan(0);
    });

    it('never goes below a rate of nothing, where the payment is the loan spread evenly', () => {
      expect(whatIf({ ...loan, rate: 1 }, -1.5)).toMatchObject({ rate: 0, payment: 555.56 });
    });
  });

  describe('rateWhatIfLoan', () => {
    const result = aResponse({
      purchase: { ...aResponse().purchase, loanAmount: 300_000 },
      baseline: aSchedule({}, 360),
    });

    it('takes the amount borrowed, the rate and the term of a fixed-rate loan', () => {
      const fixed = aResponse({
        ...result,
        baseline: aSchedule({ payments: Array.from({ length: 360 }, (_, i) => ({ ...result.baseline.payments[0], paymentNumber: i + 1, annualInterestRate: 6.25 })) }),
      });

      expect(rateWhatIfLoan(fixed)).toEqual({ amount: 300_000, rate: 6.25, termMonths: 360 });
    });

    it('offers nothing for a rate that changes, a buydown or an adjustable rate, since one rate does not describe them', () => {
      const buydown = aResponse({ ...result, buydown: { noteRate: 6, years: [], totalSubsidy: 0, paidBy: 'Buyer' as never } });
      const arm = aResponse({ ...result, adjustableRate: { worstCaseRateChanges: [], worstCasePeakPayment: 0, worstCaseTotalInterest: 0 } });

      expect(rateWhatIfLoan(buydown)).toBeNull();
      expect(rateWhatIfLoan(arm)).toBeNull();
    });

    it('offers nothing when no money is borrowed', () => {
      expect(rateWhatIfLoan(aResponse({ ...result, purchase: { ...result.purchase, loanAmount: 0 } }))).toBeNull();
    });
  });
});
