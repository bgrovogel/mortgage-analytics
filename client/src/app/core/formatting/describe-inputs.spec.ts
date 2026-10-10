import { AmortizationRequest } from '../models/amortization.models';
import { describeInputs, suggestName } from './describe-inputs';

describe('describeInputs', () => {
  const request = {
    homePrice: 375_000,
    downPayment: 18_750,
    annualInterestRate: 6.5,
    termInMonths: 360,
    extraPayments: { monthlyAmount: 200 },
  } as AmortizationRequest;

  it('sums up the loan in one line, so saved calculations can be told apart', () => {
    expect(describeInputs(request)).toBe('$375,000 home · 5% down · 6.5% · 30 yr · $200/mo extra');
  });

  it('leaves out extras when there are none, and shows odd terms in months', () => {
    expect(describeInputs({ ...request, termInMonths: 180, extraPayments: null })).toBe('$375,000 home · 5% down · 6.5% · 15 yr');
    expect(describeInputs({ ...request, termInMonths: 100, extraPayments: { monthlyAmount: 0 } as never })).toContain('100 mo');
  });

  it('rounds the down payment percentage to one decimal, and copes with a zero price', () => {
    expect(describeInputs({ ...request, downPayment: 12_345 })).toContain('3.3% down');
    expect(describeInputs({ ...request, homePrice: 0, downPayment: 0 })).toContain('0% down');
  });
});

describe('suggestName', () => {
  it('suggests a short name from the price, down payment and rate', () => {
    expect(suggestName({ homePrice: 375_000, downPayment: 75_000, annualInterestRate: 6.25 } as AmortizationRequest))
      .toBe('$375,000 home, 20% down at 6.25%');
  });
});
