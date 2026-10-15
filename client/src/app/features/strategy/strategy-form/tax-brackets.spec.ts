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

  describe('every bracket of every filing status, at its top and a dollar over', () => {
    /** The standard deduction is taken (no itemizing, no pre-tax savings), so income is taxable income plus it. */
    const STANDARD = { Single: 16_100, MarriedFilingJointly: 32_200, HeadOfHousehold: 24_150 } as const;
    /** IRS Rev. Proc. 2025-32: the top of each bracket for 2026, then its rate. */
    const TOPS: Record<TaxSituation['status'], readonly (readonly [number, number])[]> = {
      Single: [[12_400, 10], [50_400, 12], [105_700, 22], [201_775, 24], [256_225, 32], [640_600, 35]],
      MarriedFilingJointly: [[24_800, 10], [100_800, 12], [211_400, 22], [403_550, 24], [512_450, 32], [768_700, 35]],
      HeadOfHousehold: [[17_700, 10], [67_450, 12], [105_700, 22], [201_750, 24], [256_200, 32], [640_600, 35]],
    };
    const RATES = [10, 12, 22, 24, 32, 35, 37];
    const rateAt = (status: TaxSituation['status'], taxable: number) =>
      federalBracket({ income: taxable + STANDARD[status], status, pretaxSavings: 0, otherDeductions: 0, yearOneInterest: 0 }).rate;

    it.each(['Single', 'MarriedFilingJointly', 'HeadOfHousehold'] as const)('%s: a bracket ends at its top, and the next rate starts a dollar after', (status) => {
      TOPS[status].forEach(([top, rate], i) => {
        expect({ at: top, rate: rateAt(status, top) }).toEqual({ at: top, rate });
        expect({ at: top + 1, rate: rateAt(status, top + 1) }).toEqual({ at: top + 1, rate: RATES[i + 1] });
      });
    });

    it('taxes the first dollar of taxable income at 10% and a very high income at 37%', () => {
      expect(rateAt('Single', 1)).toBe(10);
      expect(rateAt('Single', 5_000_000)).toBe(37);
    });
  });

  it('long-term gains are 20% above the top of the 15% band of each filing status', () => {
    const rate = (status: TaxSituation['status'], taxable: number, standard: number) =>
      longTermGainsRate({ income: taxable + standard, status, pretaxSavings: 0, otherDeductions: 0, yearOneInterest: 0 }) - 3.8;

    expect(rate('Single', 545_500, 16_100)).toBe(15);
    expect(rate('Single', 545_501, 16_100)).toBe(20);
    expect(rate('MarriedFilingJointly', 613_700, 32_200)).toBe(15);
    expect(rate('MarriedFilingJointly', 613_701, 32_200)).toBe(20);
    expect(rate('HeadOfHousehold', 579_600, 24_150)).toBe(15);
    expect(rate('HeadOfHousehold', 579_601, 24_150)).toBe(20);
  });

  it('the investment income tax starts above $200,000 for a single or head-of-household filer, $250,000 jointly', () => {
    const rate = (status: TaxSituation['status'], income: number) =>
      longTermGainsRate({ income, status, pretaxSavings: 0, otherDeductions: 0, yearOneInterest: 0 });

    expect([rate('Single', 200_000), rate('Single', 200_001)]).toEqual([15, 18.8]);
    expect([rate('HeadOfHousehold', 200_000), rate('HeadOfHousehold', 200_001)]).toEqual([15, 18.8]);
    expect([rate('MarriedFilingJointly', 250_000), rate('MarriedFilingJointly', 250_001)]).toEqual([15, 18.8]);
  });
});
