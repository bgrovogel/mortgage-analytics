import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { RefinanceStore } from './refinance.store';

describe('RefinanceStore', () => {
  it('sends the latest request after a pause and keeps its result', () => {
    jest.useFakeTimers();
    const response = { monthlySavings: 321.69 } as RefinanceResponse;
    const analyze = jest.fn().mockReturnValue(of(response));
    TestBed.configureTestingModule({ providers: [{ provide: RefinanceApiService, useValue: { analyze } }] });
    const store = TestBed.inject(RefinanceStore);
    const request = { currentBalance: 300_000 } as RefinanceRequest;

    store.send(request);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

    expect(analyze).toHaveBeenCalledWith(request);
    expect(store.request()).toBe(request);
    expect(store.result()).toBe(response);
    expect(store.busy()).toBe(false);
    jest.useRealTimers();
  });

  it('opens a saved comparison and links to it, but leaves a purchase calculation alone', () => {
    jest.useFakeTimers();
    const analyze = jest.fn().mockReturnValue(of({} as RefinanceResponse));
    TestBed.configureTestingModule({ providers: [{ provide: RefinanceApiService, useValue: { analyze } }] });
    const store = TestBed.inject(RefinanceStore);
    const refinance = { currentBalance: 1 } as RefinanceRequest;
    const base = { id: 'r1', name: 'Refi', createdAt: '', updatedAt: '' };

    store.open({ ...base, kind: 'Purchase', inputs: {} as never, refinance: null, strategy: null });
    expect(store.saved()).toBeNull();

    store.open({ ...base, kind: 'Refinance', inputs: null, refinance });
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

    expect(store.saved()).toEqual({ id: 'r1', name: 'Refi' });
    expect(analyze).toHaveBeenCalledWith(refinance);
    jest.useRealTimers();
  });
});
