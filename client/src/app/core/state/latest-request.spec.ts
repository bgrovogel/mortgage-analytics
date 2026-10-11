import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { LatestRequest, RECALCULATE_DELAY_MS, latestRequest } from './latest-request';

/** The generic behaviour behind the calculator and the refinance comparison, with a fake call. */
describe('latestRequest', () => {
  let store: LatestRequest<Req, string>;
  let calculate: jest.Mock<Observable<string>, [Req]>;

  interface Req { extraPayments?: { monthlyAmount: number } }
  const request = (monthlyAmount = 1): Req => ({ extraPayments: { monthlyAmount } });
  const aResponse = (label = 'ok') => label;

  /** Lets the debounce elapse. */
  const settle = () => jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

  beforeEach(() => {
    jest.useFakeTimers();
    calculate = jest.fn();
    store = latestRequest((r: Req) => calculate(r), TestBed.inject(DestroyRef));
  });
  afterEach(() => jest.useRealTimers());

  describe('debouncing', () => {
    it('waits for a pause in typing before calling the API', () => {
      calculate.mockReturnValue(new Subject<string>());
      store.send(request());

      expect(calculate).not.toHaveBeenCalled();

      settle();
      expect(calculate).toHaveBeenCalledTimes(1);
    });

    it('sends only the latest of several quick changes', () => {
      calculate.mockReturnValue(of(aResponse()));

      store.send(request(1));
      store.send(request(2));
      store.send(request(3));
      settle();

      expect(calculate).toHaveBeenCalledTimes(1);
      expect(calculate.mock.calls[0][0].extraPayments!.monthlyAmount).toBe(3);
    });

    it('stays busy when an earlier response arrives while a newer change is still waiting', () => {
      const inFlight = new Subject<string>();
      calculate.mockReturnValueOnce(inFlight);
      store.send(request(1));
      settle(); // request A is now in flight

      store.send(request(2)); // change B, still inside its debounce window
      inFlight.next(aResponse()); // A answers before B has even been sent

      expect(store.busy()).toBe(true);
    });

    it('is busy from the first keystroke, not only once the request starts', () => {
      calculate.mockReturnValue(of(aResponse()));

      store.send(request());

      expect(store.busy()).toBe(true);
      settle();
      expect(store.busy()).toBe(false);
    });
  });

  describe('results', () => {
    it('ignores a slow response once a newer request has been made', () => {
      const slow = new Subject<string>();
      const fresh = aResponse('fresh');
      calculate.mockReturnValueOnce(slow).mockReturnValueOnce(of(fresh));
      store.send(request(1));
      settle();

      store.send(request(2));
      settle();
      slow.next(aResponse('stale'));

      expect(store.result()).toBe(fresh);
    });
  });

  describe('errors', () => {
    it('keeps the problem messages when the API rejects the request', () => {
      calculate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { downPayment: ['Too big.'] } } })));

      store.send(request());
      settle();

      expect(store.errors()).toEqual(['Too big.']);
      expect(store.busy()).toBe(false);
    });

    it('recovers after a failure: the next request still runs and clears the errors', () => {
      calculate
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
        .mockReturnValueOnce(of(aResponse()));
      store.send(request(1));
      settle();

      store.send(request(2));
      settle();

      expect(store.errors()).toEqual([]);
      expect(store.result()).not.toBeNull();
    });
  });
});
