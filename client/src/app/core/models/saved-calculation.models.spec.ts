import { AmortizationRequest } from './amortization.models';
import { RefinanceRequest } from './refinance.models';
import { SavedCalculation, requestOf, savedInputsFor, savedInputsOf } from './saved-calculation.models';

describe('saved calculation inputs', () => {
  const first = { homePrice: 415_000 } as AmortizationRequest;
  const second = { homePrice: 450_000 } as AmortizationRequest;
  const refinance = { currentBalance: 300_000 } as RefinanceRequest;
  const saved = (fields: Partial<SavedCalculation>): SavedCalculation => ({
    id: 'c1', name: 'A save', kind: 'Purchase', inputs: null, secondHome: null, refinance: null, strategy: null, createdAt: '', updatedAt: '',
    ...fields,
  });

  it('saves each kind in its own field', () => {
    expect(savedInputsFor('Purchase', first)).toEqual({ inputs: first });
    expect(savedInputsFor('Refinance', refinance)).toEqual({ refinance });
  });

  it('saves a comparison as the first home in the inputs, and the second beside it', () => {
    expect(savedInputsFor('HomeComparison', { first, second })).toEqual({ inputs: first, secondHome: second });
  });

  it('reads back the request each kind was saved from', () => {
    expect(requestOf(saved({ kind: 'Purchase', inputs: first }))).toBe(first);
    expect(requestOf(saved({ kind: 'Refinance', refinance }))).toBe(refinance);
    expect(requestOf(saved({ kind: 'HomeComparison', inputs: first, secondHome: second }))).toEqual({ first, second });
  });

  it('saves a saved calculation again unchanged, e.g. under a new name', () => {
    expect(savedInputsOf(saved({ kind: 'HomeComparison', inputs: first, secondHome: second }))).toEqual({ inputs: first, secondHome: second });
  });
});
