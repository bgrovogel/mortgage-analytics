import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { aResponse, aSavings } from '../../../testing/builders';
import { AmortizationRequest } from '../../core/models/amortization.models';
import { SavedCalculation } from '../../core/models/saved-calculation.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { SharedLoanStore } from '../../core/state/shared-loan.store';
import { CalculatorStore } from './calculator.store';
import { ComparisonStore } from './comparison.store';

describe('ComparisonStore', () => {
  const first = { homePrice: 415_000, downPayment: 37_350, annualInterestRate: 6.25, termInMonths: 360 } as AmortizationRequest;
  const second = { homePrice: 450_000, downPayment: 90_000, annualInterestRate: 6, termInMonths: 360 } as AmortizationRequest;
  const third = { homePrice: 380_000, downPayment: 76_000, annualInterestRate: 6.5, termInMonths: 360 } as AmortizationRequest;
  const responseFor = (r: AmortizationRequest) => aResponse({ savings: aSavings({ netSavings: r.homePrice }) });

  let store: ComparisonStore;
  let calculate: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    calculate = jest.fn((r: AmortizationRequest) => of(responseFor(r)));
    TestBed.configureTestingModule({ providers: [{ provide: AmortizationApiService, useValue: { calculate } }] });
    store = TestBed.inject(ComparisonStore);
  });
  afterEach(() => jest.useRealTimers());

  it('calculates each home on its own, and keeps the results side by side, in order', () => {
    store.send({ homes: [first, second, third] });
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

    expect(calculate.mock.calls.map(([r]) => r)).toEqual([first, second, third]);
    expect(store.result()?.homes.map((h) => h.savings.netSavings)).toEqual([415_000, 450_000, 380_000]);
  });

  it('saves the homes as one comparison, named and described by them', () => {
    store.send({ homes: [first, second, third] });

    expect(store.kind).toBe('HomeComparison');
    expect(store.savePayload()).toEqual({ inputs: first, otherHomes: [second, third] });
    expect(store.suggestedName()).toBe('$415,000, $450,000 or $380,000 home');
    expect(store.describe({ homes: [first, second] })).toBe('$415,000 home, 9% down at 6.25% vs $450,000 home, 20% down at 6%');
  });

  it('leaves another kind of saved calculation, and the calculator, alone', () => {
    const calculator = TestBed.inject(CalculatorStore);
    calculator.linkTo({ id: 'p1', name: 'A purchase' });

    store.open({
      id: 'p2', name: 'Oak St', kind: 'Purchase', inputs: first, otherHomes: null, refinance: null, strategy: null, createdAt: '', updatedAt: '',
    });

    expect(store.request()).toBeNull();
    expect(calculator.request()).toBeNull();
    expect(calculator.saved()).toEqual({ id: 'p1', name: 'A purchase' });
  });

  it('opens a saved comparison on the Compare tab, with the first home in the calculator', () => {
    const calculator = TestBed.inject(CalculatorStore);
    calculator.linkTo({ id: 'p1', name: 'A purchase' });
    const saved: SavedCalculation = {
      id: 'c1', name: 'Oak or Elm', kind: 'HomeComparison', inputs: first, otherHomes: [second, third], refinance: null, strategy: null,
      createdAt: '', updatedAt: '',
    };

    store.open(saved);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

    expect(store.route).toEqual(['/calculator', 'compare']);
    expect(store.saved()).toEqual({ id: 'c1', name: 'Oak or Elm' });
    expect(store.request()).toEqual({ homes: [first, second, third] });
    expect(calculator.request()).toBe(first);
    // The calculator now shows the comparison's first home: Save there makes a new purchase, not a change to another.
    expect(calculator.saved()).toBeNull();
    expect(TestBed.inject(SharedLoanStore).change()?.loan.balance).toBe(377_650);
  });
});
