import { AmortizationRequest } from '../models/amortization.models';
import { RefinanceRequest } from '../models/refinance.models';
import { StrategyRequest } from '../models/strategy.models';
import { describeInputs, describeRefinance, describeStrategy, suggestName, suggestRefinanceName, suggestStrategyName } from './describe-inputs';

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

  it('names a buydown or an adjustable rate', () => {
    expect(describeInputs({ ...request, buydown: { yearlyReductions: [2, 1] } })).toContain('6.5% · 30 yr · 2-1 buydown');
    const arm = { initialFixedMonths: 84, adjustmentIntervalMonths: 12, expectedRate: 7.5, initialCap: 5, periodicCap: 2, lifetimeCap: 5 };
    expect(describeInputs({ ...request, adjustableRate: arm })).toContain('7/1 ARM');
    expect(describeInputs({ ...request, adjustableRate: { ...arm, initialFixedMonths: 60, adjustmentIntervalMonths: 6 } })).toContain('5/6 ARM');
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

describe('describeRefinance', () => {
  const refinance: RefinanceRequest = {
    currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
    newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false,
  };

  it('sums up the refinance in one line', () => {
    expect(describeRefinance(refinance)).toBe('$300,000 left at 7% → 6% · 30 yr · $6,000 closing costs');
  });

  it('says when the closing costs are rolled into the loan', () => {
    expect(describeRefinance({ ...refinance, financeClosingCosts: true })).toContain('$6,000 closing costs in the loan');
  });

  it('suggests a name from the two rates', () => {
    expect(suggestRefinanceName(refinance)).toBe('Refinance 7% → 6%, 30 yr');
  });

  it('describes and names a pay-off-or-invest comparison', () => {
    const r = { currentBalance: 300_000, annualInterestRate: 6.5, monthlyCashToPutToWork: 1_000, riskProfile: 'Conservative' } as StrategyRequest;

    expect(describeStrategy(r)).toBe('$300,000 left at 6.5% · $1,000/mo to put to work · Conservative');
    expect(suggestStrategyName(r)).toBe('Pay off or invest: $1,000/mo, 6.5% mortgage');
  });
});
