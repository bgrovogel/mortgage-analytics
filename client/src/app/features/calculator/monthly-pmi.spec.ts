import { AmortizationRequest } from '../../core/models/amortization.models';
import { monthlyPmiOf } from './calculator.store';

describe('monthlyPmiOf', () => {
  const fivePercentDown = { homePrice: 375_000, downPayment: 18_750, housingCosts: { pmiRate: 0.5 } } as AmortizationRequest;

  it('is the yearly rate on the loan, a twelfth a month, when more than 80% is borrowed', () => {
    expect(monthlyPmiOf(fivePercentDown)).toBe(148.44); // 0.5% of $356,250 / 12
  });

  it('is 0 with 20% down, or no PMI rate', () => {
    expect(monthlyPmiOf({ ...fivePercentDown, downPayment: 75_000 })).toBe(0);
    expect(monthlyPmiOf({ ...fivePercentDown, housingCosts: { ...fivePercentDown.housingCosts!, pmiRate: 0 } })).toBe(0);
  });

  it('is not said for FHA or VA, whose mortgage insurance is not PMI', () => {
    expect(monthlyPmiOf({ ...fivePercentDown, program: { type: 'Fha' } } as AmortizationRequest)).toBeNull();
    expect(monthlyPmiOf({ ...fivePercentDown, program: { type: 'Conventional' } } as AmortizationRequest)).toBe(148.44);
  });
});
