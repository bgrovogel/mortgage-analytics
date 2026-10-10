import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { aResponse, aSavings } from '../../../testing/builders';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { SavedCalculation } from '../../core/models/saved-calculation.models';
import { RefinanceRequest } from '../../core/models/refinance.models';
import { CalculatorStore, RECALCULATE_DELAY_MS } from './calculator.store';

describe('CalculatorStore', () => {
  let store: CalculatorStore;
  let calculate: jest.Mock<Observable<AmortizationResponse>, [AmortizationRequest]>;

  const request = (monthlyAmount = 1) => ({ homePrice: 1, extraPayments: { monthlyAmount } }) as AmortizationRequest;

  /** Lets the debounce elapse. */
  const settle = () => jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

  beforeEach(() => {
    jest.useFakeTimers();
    calculate = jest.fn();
    TestBed.configureTestingModule({ providers: [{ provide: AmortizationApiService, useValue: { calculate } }] });
    store = TestBed.inject(CalculatorStore);
  });
  afterEach(() => jest.useRealTimers());

  describe('results', () => {
    it('keeps the latest result and the request it answers', () => {
      const response = aResponse({ savings: aSavings({ netSavings: 1_234 }) });
      calculate.mockReturnValue(of(response));

      store.send(request(7));
      settle();

      expect(store.result()).toBe(response);
      expect(store.request()?.extraPayments?.monthlyAmount).toBe(7);
    });

    it('remembers the latest request at once, so a page opened mid-typing restores it', () => {
      calculate.mockReturnValue(new Subject());

      store.send(request(9));

      expect(store.request()?.extraPayments?.monthlyAmount).toBe(9);
    });
  });

  describe('saved calculations', () => {
    const saved: SavedCalculation = { id: 'abc', name: 'Oak St', kind: 'Purchase', inputs: request(42), refinance: null, strategy: null, createdAt: '', updatedAt: '' };

    it('is not linked to a saved calculation at first', () => {
      expect(store.saved()).toBeNull();
    });

    it('opens a saved calculation: its inputs become the request, and it is calculated', () => {
      calculate.mockReturnValue(of(aResponse()));

      store.open(saved);
      settle();

      expect(store.request()).toBe(saved.inputs);
      expect(calculate).toHaveBeenCalledWith(saved.inputs);
      expect(store.saved()).toEqual({ id: 'abc', name: 'Oak St' });
    });

    it('leaves a refinance comparison to the Refinance page', () => {
      store.open({ ...saved, kind: 'Refinance', inputs: null, refinance: {} as RefinanceRequest });

      expect(store.saved()).toBeNull();
      expect(store.request()).toBeNull();
    });

    it('remembers which saved calculation the current one is, after saving or renaming it', () => {
      store.linkTo({ ...saved, name: 'Renamed' });

      expect(store.saved()).toEqual({ id: 'abc', name: 'Renamed' });
    });
  });
});
