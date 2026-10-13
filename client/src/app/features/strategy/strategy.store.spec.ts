import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StrategyComparison, StrategyRequest } from '../../core/models/strategy.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { SharedLoanStore } from '../../core/state/shared-loan.store';
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

  it('shares the PMI on the loan, and none when the request gives none', () => {
    TestBed.configureTestingModule({ providers: [{ provide: StrategyApiService, useValue: { compare: jest.fn().mockReturnValue(of({})) } }] });
    const store = TestBed.inject(StrategyStore);
    const shared = TestBed.inject(SharedLoanStore);
    const request = { currentBalance: 370_000, annualInterestRate: 6.5, remainingTermInMonths: 360, homeValue: 400_000 } as StrategyRequest;

    store.send(request); // the page's example, which is not shared
    store.send({ ...request, monthlyPmi: 150 });
    const withPmi = shared.change()!.loan.monthlyPmi;
    store.send({ ...request, currentBalance: 360_000 });

    expect(withPmi).toBe(150);
    expect(shared.change()!.loan.monthlyPmi).toBe(0);
  });
});
