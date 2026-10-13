import { TaxSituation, federalBracket, longTermGainsRate } from './tax-brackets';

describe('the 2026 federal tax brackets', () => {
  const typical: TaxSituation = {
    income: 120_000, status: 'MarriedFilingJointly', pretaxSavings: 7_200, otherDeductions: 10_000, yearOneInterest: 19_500,
  };

  it('puts the typical household in the 12% bracket, on its income after the standard deduction and the 401(k)', () => {
    // $120,000 − $7,200 − $32,200 = $80,600, under the $100,800 top of the joint 12% bracket.
    expect(federalBracket(typical)).toEqual({ rate: 12, taxableIncome: 80_600, deductions: 32_200 });
  });

  it('takes itemized deductions when they are larger than the standard deduction', () => {
    // A single filer on $250,000 itemizing $77,000 is in the 24% bracket, not the 32% the standard deduction would give.
    const itemizer: TaxSituation = { income: 250_000, status: 'Single', pretaxSavings: 15_000, otherDeductions: 28_000, yearOneInterest: 49_000 };

    expect(federalBracket(itemizer)).toEqual({ rate: 24, taxableIncome: 158_000, deductions: 77_000 });
    expect(federalBracket({ ...itemizer, otherDeductions: 0, yearOneInterest: 0 }).rate).toBe(32);
  });

  it.each([
    [0, 10],
    [24_800 + 32_200, 10],
    [24_800.01 + 32_200, 12],
    [500_000, 32],
    [1_000_000, 37],
  ])('a joint income of $%d is in the %d%% bracket (with no other deductions)', (income, rate) => {
    expect(federalBracket({ ...typical, income, pretaxSavings: 0, otherDeductions: 0, yearOneInterest: 0 }).rate).toBe(rate);
  });

  it('has each filing status its own brackets', () => {
    const at = (status: TaxSituation['status']) =>
      federalBracket({ income: 100_000, status, pretaxSavings: 0, otherDeductions: 0, yearOneInterest: 0 }).rate;

    expect([at('Single'), at('HeadOfHousehold'), at('MarriedFilingJointly')]).toEqual([22, 22, 12]);
  });

  it('taxes long-term gains at 15% for most, 20% at the top, and 3.8% more above the investment income threshold', () => {
    expect(longTermGainsRate(typical)).toBe(15);
    expect(longTermGainsRate({ ...typical, income: 300_000 })).toBe(18.8); // over $250,000 jointly
    expect(longTermGainsRate({ ...typical, income: 210_000, status: 'Single' })).toBe(18.8); // over $200,000 single
    expect(longTermGainsRate({ ...typical, income: 900_000 })).toBe(23.8); // above the 15% bracket's $613,700
  });

  it('starts the 3.8% and the 20% only above their thresholds, not at them', () => {
    expect(longTermGainsRate({ ...typical, income: 250_000 })).toBe(15);
    // $653,100 − $7,200 − $32,200 is exactly $613,700 taxable: still the 15% band.
    expect(longTermGainsRate({ ...typical, income: 653_100 })).toBe(18.8);
  });
});
