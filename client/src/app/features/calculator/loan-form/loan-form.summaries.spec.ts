import { costsSummary, growthSummary, incomeSummary, optionsSummary, taxesSummary } from './loan-form.summaries';

describe('loan form section summaries', () => {
  describe('taxesSummary', () => {
    it('names the one combined rate and the homestead exemption taken off it', () => {
      const v = { taxMode: 'single' as const, propertyTaxRate: 2.1, propertyTaxHomesteadExemption: 100_000 };

      expect(taxesSummary(v, { homestead: true, over65: false })).toBe('Tax 2.1% · Homestead $100,000 off');
    });

    it('names each separate tax and PID, then the homestead and over-65 relief', () => {
      const v = { taxMode: 'separate' as const, schoolTaxRate: 1, localTaxRate: 0.5, mudTaxRate: 0, pidAnnual: 1_200 };

      expect(taxesSummary(v, { homestead: true, over65: true })).toBe('School 1% · County/city 0.5% · PID $1,200/yr · Homestead · Over 65');
    });

    it('says when there are no property taxes, whatever the homestead setting', () => {
      expect(taxesSummary({ taxMode: 'single', propertyTaxRate: 0 }, { homestead: true, over65: false })).toBe('No property taxes');
    });
  });

  describe('costsSummary', () => {
    it('lists insurance, HOA and PMI, but PMI only when the down payment needs it', () => {
      const v = { annualInsurance: 1_800, monthlyHoa: 50, pmiRate: 0.5 };

      expect(costsSummary(v, { pmiApplies: true })).toBe('Insurance $1,800/yr · HOA $50/mo · PMI 0.5%');
      expect(costsSummary(v, { pmiApplies: false })).toBe('Insurance $1,800/yr · HOA $50/mo');
    });

    it('says None when there are no costs', () => {
      expect(costsSummary({}, { pmiApplies: true })).toBe('None');
    });
  });

  describe('growthSummary', () => {
    it('signs each yearly change, and counts a blank as no change', () => {
      expect(growthSummary({ homeValueGrowthRate: 3, insuranceIncreaseRate: -2 })).toBe('Home +3% · Insurance -2% · HOA 0%');
    });
  });

  describe('incomeSummary', () => {
    it('gives the income a year and the debts a month, a blank debt as none', () => {
      expect(incomeSummary({ annualIncome: 150_000, monthlyDebts: 600 })).toBe('Income $150,000/yr · Debts $600/mo');
      expect(incomeSummary({ annualIncome: 150_000, monthlyDebts: null })).toBe('Income $150,000/yr · Debts $0/mo');
    });

    it('counts the buyers and adds their incomes and debts together', () => {
      const v = { annualIncome: 90_000, monthlyDebts: 400, coBuyers: [{ annualIncome: 60_000, monthlyDebts: 200 }, { annualIncome: 30_000, monthlyDebts: null }] };

      expect(incomeSummary(v)).toBe('3 buyers · Income $180,000/yr · Debts $600/mo');
    });

    it('leaves a co-buyer with no income out of the count', () => {
      expect(incomeSummary({ annualIncome: 90_000, monthlyDebts: 0, coBuyers: [{ annualIncome: null, monthlyDebts: 100 }] })).toBe('Income $90,000/yr · Debts $0/mo');
    });

    it('invites an income when there is none', () => {
      expect(incomeSummary({ annualIncome: null })).toBe('Add yours to see what you can afford');
    });
  });

  describe('optionsSummary', () => {
    it('lists the yearly extra and lump sums, then where extra payments go', () => {
      expect(optionsSummary({ annualExtra: 5_000, lumpSums: [{}, {}], strategy: 'ShortenTerm' })).toBe('$5,000 yearly · 2 lump sums · Pay off sooner');
    });

    it('names a single lump sum, and the recast minimum when recasting', () => {
      expect(optionsSummary({ lumpSums: [{}], strategy: 'Recast', recastMinimum: 10_000 })).toBe('1 lump sum · Recast (min $10,000)');
    });
  });
});

describe('summaries, counted', () => {
  it('say "Homestead" alone when its exemption is blank, and count rate changes', () => {
    expect(taxesSummary({ taxMode: 'single', propertyTaxRate: 2 }, { homestead: true, over65: false, rateChanges: 1 }))
      .toBe('Tax 2% · Homestead · 1 rate change');
    expect(taxesSummary({ taxMode: 'single', propertyTaxRate: 2 }, { homestead: false, over65: false, rateChanges: 2 }))
      .toBe('Tax 2% · 2 rate changes');
  });

  it('count no lump sums when there is no list yet', () => {
    expect(() => optionsSummary({})).not.toThrow();
  });
});
