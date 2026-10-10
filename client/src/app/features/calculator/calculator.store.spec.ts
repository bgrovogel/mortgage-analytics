import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { aResponse, aSavings } from '../../../testing/builders';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
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

  describe('debouncing', () => {
    it('waits for a pause in typing before calling the API', () => {
      calculate.mockReturnValue(new Subject());
      store.calculate(request());

      expect(calculate).not.toHaveBeenCalled();

      settle();
      expect(calculate).toHaveBeenCalledTimes(1);
    });

    it('sends only the latest of several quick changes', () => {
      calculate.mockReturnValue(of(aResponse()));

      store.calculate(request(1));
      store.calculate(request(2));
      store.calculate(request(3));
      settle();

      expect(calculate).toHaveBeenCalledTimes(1);
      expect(calculate.mock.calls[0][0].extraPayments!.monthlyAmount).toBe(3);
    });

    it('stays busy when an earlier response arrives while a newer change is still waiting', () => {
      const inFlight = new Subject<AmortizationResponse>();
      calculate.mockReturnValueOnce(inFlight);
      store.calculate(request(1));
      settle(); // request A is now in flight

      store.calculate(request(2)); // change B, still inside its debounce window
      inFlight.next(aResponse()); // A answers before B has even been sent

      expect(store.busy()).toBe(true);
    });

    it('is busy from the first keystroke, not only once the request starts', () => {
      calculate.mockReturnValue(of(aResponse()));

      store.calculate(request());

      expect(store.busy()).toBe(true);
      settle();
      expect(store.busy()).toBe(false);
    });
  });

  describe('results', () => {
    it('keeps the latest result and the request it answers', () => {
      const response = aResponse({ savings: aSavings({ netSavings: 1_234 }) });
      calculate.mockReturnValue(of(response));

      store.calculate(request(7));
      settle();

      expect(store.result()).toBe(response);
      expect(store.request()?.extraPayments?.monthlyAmount).toBe(7);
    });

    it('remembers the latest request at once, so a page opened mid-typing restores it', () => {
      calculate.mockReturnValue(new Subject());

      store.calculate(request(9));

      expect(store.request()?.extraPayments?.monthlyAmount).toBe(9);
    });

    it('ignores a slow response once a newer request has been made', () => {
      const slow = new Subject<AmortizationResponse>();
      const fresh = aResponse({ savings: aSavings({ netSavings: 2 }) });
      calculate.mockReturnValueOnce(slow).mockReturnValueOnce(of(fresh));
      store.calculate(request(1));
      settle();

      store.calculate(request(2));
      settle();
      slow.next(aResponse({ savings: aSavings({ netSavings: 1 }) }));

      expect(store.result()).toBe(fresh);
    });
  });

  describe('errors', () => {
    it('keeps the problem messages when the API rejects the request', () => {
      calculate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { downPayment: ['Too big.'] } } })));

      store.calculate(request());
      settle();

      expect(store.errors()).toEqual(['Too big.']);
      expect(store.busy()).toBe(false);
    });

    it('recovers after a failure: the next request still runs and clears the errors', () => {
      calculate
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
        .mockReturnValueOnce(of(aResponse()));
      store.calculate(request(1));
      settle();

      store.calculate(request(2));
      settle();

      expect(store.errors()).toEqual([]);
      expect(store.result()).not.toBeNull();
    });
  });

  describe('saved calculations', () => {
    const saved = { id: 'abc', name: 'Oak St', inputs: request(42), createdAt: '', updatedAt: '' };

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

    it('remembers which saved calculation the current one is, after saving or renaming it', () => {
      store.linkTo({ ...saved, name: 'Renamed' });

      expect(store.saved()).toEqual({ id: 'abc', name: 'Renamed' });
    });
  });
});
