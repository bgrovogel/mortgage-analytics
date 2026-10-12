import { aHousingCosts, aProjectionYear } from '../../../../testing/builders';
import { costTotals, startingYear } from './cost-totals';

describe('costTotals', () => {
  // Three years: tax rises, PMI stops after year 2, and nothing is ever paid in HOA dues.
  const projection = [
    aProjectionYear(1, { costs: aHousingCosts({ propertyTax: 6_000, mortgageInsurance: 1_200, total: 7_200 }) }),
    aProjectionYear(2, { costs: aHousingCosts({ propertyTax: 6_300, mortgageInsurance: 1_200, total: 7_500 }) }),
    aProjectionYear(3, { costs: aHousingCosts({ propertyTax: 6_600, mortgageInsurance: 0, total: 6_600 }) }),
  ];

  it('gives each cost that year, through that year, and over the whole loan', () => {
    const totals = costTotals(projection, 2);

    expect(totals.rows.map((r) => [r.label, r.thisYear, r.toDate, r.wholeLoan])).toEqual([
      ['Property tax', 6_300, 12_300, 18_900],
      ['PMI', 1_200, 2_400, 2_400],
    ]);
  });

  it('leaves out a cost that is never paid, as the chart does', () => {
    expect(costTotals(projection, 1).rows.map((r) => r.label)).not.toContain('HOA dues');
  });

  it('totals every cost, and says what that year comes to each month', () => {
    expect(costTotals(projection, 2).total).toEqual({ thisYear: 7_500, monthly: 625, toDate: 14_700, wholeLoan: 21_300 });
  });

  it('keeps each cost in the colour the chart draws it in', () => {
    expect(costTotals(projection, 1).rows[0].color).toBe('--series-2');
  });
});

describe('startingYear', () => {
  const years = [1, 2, 3].map((year) => aProjectionYear(year, { startDate: `${2025 + year}-01-01` }));

  it('starts a new loan at year 1', () => {
    expect(startingYear(years, new Date('2025-06-15'))).toBe(1);
  });

  it('starts a loan already being paid at the year it is in now', () => {
    expect(startingYear(years, new Date('2027-08-01'))).toBe(2);
  });

  it('stops at the last year once the loan is over', () => {
    expect(startingYear(years, new Date('2040-01-01'))).toBe(3);
  });
});
