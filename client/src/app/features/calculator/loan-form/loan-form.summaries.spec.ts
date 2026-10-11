import { costsSummary, growthSummary, optionsSummary, taxesSummary } from './loan-form.summaries';

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

  describe('optionsSummary', () => {
    it('lists the yearly extra and lump sums, then where extra payments go', () => {
      expect(optionsSummary({ annualExtra: 5_000, lumpSums: [{}, {}], strategy: 'ShortenTerm' })).toBe('$5,000 yearly · 2 lump sums · Pay off sooner');
    });

    it('names a single lump sum, and the recast minimum when recasting', () => {
      expect(optionsSummary({ lumpSums: [{}], strategy: 'Recast', recastMinimum: 10_000 })).toBe('1 lump sum · Recast (min $10,000)');
    });
  });
});
