import { COST_CATEGORIES, costCategoriesFor, mortgageInsuranceName } from './cost-categories';

describe('cost categories', () => {
  const insuranceLabel = (type?: 'Fha' | 'Va') =>
    costCategoriesFor(type ? { type } : null).find((c) => c.key === 'mortgageInsurance')!.label;

  it("call an FHA loan's mortgage insurance MIP, and everything else's PMI", () => {
    expect(insuranceLabel('Fha')).toBe('FHA MIP');
    expect(insuranceLabel('Va')).toBe('PMI');
    expect(insuranceLabel()).toBe('PMI');
    expect(mortgageInsuranceName({ type: 'Fha' })).toBe('MIP');
    expect(mortgageInsuranceName(null)).toBe('PMI');
  });

  it('keep every other category, in the same order and colors', () => {
    expect(costCategoriesFor({ type: 'Fha' }).map((c) => [c.key, c.color])).toEqual(COST_CATEGORIES.map((c) => [c.key, c.color]));
  });
});
