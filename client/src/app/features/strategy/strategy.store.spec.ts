import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StrategyComparison, StrategyRequest } from '../../core/models/strategy.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { StrategyStore } from './strategy.store';

describe('StrategyStore', () => {
  it('opens a saved comparison and links to it, but leaves other kinds alone', () => {
    jest.useFakeTimers();
    const compare = jest.fn().mockReturnValue(of({} as StrategyComparison));
    TestBed.configureTestingModule({ providers: [{ provide: StrategyApiService, useValue: { compare } }] });
    const store = TestBed.inject(StrategyStore);
    const strategy = { currentBalance: 1 } as StrategyRequest;
    const base = { id: 's1', name: 'Pay off?', createdAt: '', updatedAt: '', inputs: null, refinance: null };

    store.open({ ...base, kind: 'Refinance', strategy: null });
    expect(store.saved()).toBeNull();

    store.open({ ...base, kind: 'Strategy', strategy });
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

    expect(store.saved()).toEqual({ id: 's1', name: 'Pay off?' });
    expect(compare).toHaveBeenCalledWith(strategy);
    jest.useRealTimers();
  });
});
