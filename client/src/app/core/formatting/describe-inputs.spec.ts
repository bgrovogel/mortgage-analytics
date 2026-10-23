import { chooseLanguage } from '../i18n/i18n';
import { AmortizationRequest } from '../models/amortization.models';
import { RefinanceRequest } from '../models/refinance.models';
import { StrategyRequest } from '../models/strategy.models';
import {
  describeComparison, describeInputs, describeRefinance, describeStrategy, purchaseFigure, refinanceFigure, suggestComparisonName, suggestName,
  suggestRefinanceName, suggestStrategyName,
} from './describe-inputs';

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

describe('a comparison of homes', () => {
  const first = { homePrice: 415_000, downPayment: 37_350, annualInterestRate: 6.25, termInMonths: 360 } as AmortizationRequest;
  const second = { homePrice: 450_000, downPayment: 90_000, annualInterestRate: 6, termInMonths: 360 } as AmortizationRequest;
  const third = { homePrice: 380_000, downPayment: 76_000, annualInterestRate: 6.5, termInMonths: 360 } as AmortizationRequest;

  it('sums up every home in one line: what most often tells them apart', () => {
    expect(describeComparison({ homes: [first, second] })).toBe('$415,000 home, 9% down at 6.25% vs $450,000 home, 20% down at 6%');
    expect(describeComparison({ homes: [first, second, third] }))
      .toBe('$415,000 home, 9% down at 6.25% vs $450,000 home, 20% down at 6% vs $380,000 home, 20% down at 6.5%');
  });

  it('keeps a space on both sides of "vs" in Spanish, so the homes do not run together', async () => {
    await chooseLanguage('es');
    try {
      expect(describeComparison({ homes: [first, second] })).toBe('Casa de $415,000, 9% de pago inicial a 6.25% vs Casa de $450,000, 20% de pago inicial a 6%');
    } finally {
      await chooseLanguage('en');
    }
  });

  it('suggests a name from the prices', () => {
    expect(suggestComparisonName({ homes: [first, second] })).toBe('$415,000 or $450,000 home');
    expect(suggestComparisonName({ homes: [first, second, third] })).toBe('$415,000, $450,000 or $380,000 home');
  });
});

describe('suggestName', () => {
  it('suggests a short name from the price, down payment and rate', () => {
    expect(suggestName({ homePrice: 375_000, downPayment: 75_000, annualInterestRate: 6.25 } as AmortizationRequest))
      .toBe('$375,000 home, 20% down at 6.25%');
  });
});

describe('the figure on a saved card', () => {
  const purchase = { homePrice: 415_000, downPayment: 37_350, annualInterestRate: 6.25, termInMonths: 360 } as AmortizationRequest;
  const refinance: RefinanceRequest = {
    currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
    newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false,
  };

  it('is the principal and interest of a purchase, from its own numbers', () => {
    expect(purchaseFigure(purchase)).toBe('$2,325.26 a month, principal and interest');
  });

  it('adds the upfront premium an FHA or VA loan borrows, which these numbers cannot know, by leaving the figure out', () => {
    expect(purchaseFigure({ ...purchase, program: { type: 'Fha', vaUse: null, financeUpfrontFee: true } })).toBeNull();
    expect(purchaseFigure({ ...purchase, program: { type: 'Va', vaUse: 'FirstUse', financeUpfrontFee: true } })).toBeNull();
  });

  it('leaves out a purchase with an adjustable rate or a buydown, whose first payment is not one number', () => {
    expect(purchaseFigure({ ...purchase, adjustableRate: { initialFixedMonths: 60 } as never })).toBeNull();
    expect(purchaseFigure({ ...purchase, buydown: { yearlyReductions: [2, 1] } as never })).toBeNull();
  });

  it('is there for a conventional loan named as such, and has nothing for a loan with nothing borrowed', () => {
    expect(purchaseFigure({ ...purchase, program: { type: 'Conventional', vaUse: null, financeUpfrontFee: false } })).toBe('$2,325.26 a month, principal and interest');
    expect(purchaseFigure({ ...purchase, downPayment: 415_000 })).toBeNull();
    expect(refinanceFigure({ ...refinance, currentBalance: 0 })).toBeNull();
  });

  it('is left out for a refinance to an adjustable rate or with a buydown', () => {
    expect(refinanceFigure({ ...refinance, newAdjustableRate: { initialFixedMonths: 60 } as never })).toBeNull();
    expect(refinanceFigure({ ...refinance, newBuydown: { yearlyReductions: [2, 1] } as never })).toBeNull();
  });

  it('is the new payment of a refinance, with financed costs and cash out borrowed too', () => {
    expect(refinanceFigure(refinance)).toBe('$1,798.65 a month on the new loan, principal and interest');
    expect(refinanceFigure({ ...refinance, financeClosingCosts: true })).toBe('$1,834.62 a month on the new loan, principal and interest');
    expect(refinanceFigure({ ...refinance, cashOut: 50_000 })).toBe('$2,098.43 a month on the new loan, principal and interest');
  });

  it('is left out for a refinance that starts from the original loan, whose balance the server works out', () => {
    expect(refinanceFigure({ ...refinance, originalLoan: { amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' } })).toBeNull();
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

  it('says how much cash is taken out, when any is', () => {
    expect(describeRefinance({ ...refinance, cashOut: 50_000 })).toBe('$300,000 left at 7% → 6% · 30 yr · $50,000 cash out · $6,000 closing costs');
  });

  it('suggests a name from the two rates', () => {
    expect(suggestRefinanceName(refinance)).toBe('Refinance 7% → 6%, 30 yr');
  });

  it('describes and names a pay-off-or-invest comparison', () => {
    const r = { currentBalance: 300_000, annualInterestRate: 6.5, monthlyCashToPutToWork: 1_000, riskProfile: 'Conservative' } as StrategyRequest;

    expect(describeStrategy(r)).toBe('$300,000 left at 6.5% · $1,000/mo to put to work · Conservative');
    expect(suggestStrategyName(r)).toBe('Pay off or invest: $1,000/mo, 6.5% mortgage');
  });

  it('names the risk profile in the page’s language', async () => {
    const r = { currentBalance: 300_000, annualInterestRate: 6.5, monthlyCashToPutToWork: 1_000, riskProfile: 'Conservative' } as StrategyRequest;
    await chooseLanguage('es');
    try {
      expect(describeStrategy(r)).toContain('Conservador');
    } finally {
      await chooseLanguage('en');
    }
  });
});
