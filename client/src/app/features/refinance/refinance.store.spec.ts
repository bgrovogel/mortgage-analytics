import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { SharedLoanStore } from '../../core/state/shared-loan.store';
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
    const base = { id: 'r1', name: 'Refi', createdAt: '', updatedAt: '', secondHome: null };

    store.open({ ...base, kind: 'Purchase', inputs: {} as never, refinance: null, strategy: null });
    expect(store.saved()).toBeNull();

    store.open({ ...base, kind: 'Refinance', inputs: null, refinance, strategy: null });
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

    expect(store.saved()).toEqual({ id: 'r1', name: 'Refi' });
    expect(analyze).toHaveBeenCalledWith(refinance);
    jest.useRealTimers();
  });
});

describe('RefinanceStore and the shared loan', () => {
  const loan = (overrides: Partial<RefinanceRequest> = {}) => ({
    currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, currentAdjustableRate: null, originalLoan: null, ...overrides,
  }) as unknown as RefinanceRequest;

  function setUp() {
    TestBed.configureTestingModule({ providers: [{ provide: RefinanceApiService, useValue: { analyze: jest.fn().mockReturnValue(of({})) } }] });
    return { store: TestBed.inject(RefinanceStore), shared: TestBed.inject(SharedLoanStore) };
  }

  it('shares how the loan started, when it is given', () => {
    const { store, shared } = setUp();
    const originalLoan = { amount: 320_000, termInMonths: 360, firstPaymentDate: '2021-11-01' };
    store.send(loan());
    store.send(loan({ currentBalance: 290_000, originalLoan }));

    expect(shared.change()!.loan.start).toEqual(originalLoan);
  });

  it('holds a shared buydown as fixed: it is not shared back, and it stays a buydown when the loan changes', () => {
    const { store, shared } = setUp();
    shared.update({ balance: 300_000, annualInterestRate: 7, remainingTermInMonths: 300, homeValue: null, rate: { kind: 'buydown', yearlyReductions: [2, 1] } }, 'Calculator');
    store.send(loan({ currentBalance: 1 }));
    store.send(loan());
    const from = shared.change()!.from;
    store.send(loan({ currentBalance: 280_000 }));

    expect(from).toBe('Calculator');
    expect(shared.change()!.loan.rate).toEqual({ kind: 'buydown', yearlyReductions: [2, 1] });
  });

  it('sends nothing again before it has a request', () => {
    const analyze = jest.fn();
    TestBed.configureTestingModule({ providers: [{ provide: RefinanceApiService, useValue: { analyze } }] });
    jest.useFakeTimers();
    TestBed.inject(RefinanceStore).retry();
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    jest.useRealTimers();

    expect(analyze).not.toHaveBeenCalled();
  });

  it("shares the home's value and today's PMI, and neither when no value is given", () => {
    const { store, shared } = setUp();
    store.send(loan()); // the page's example, which is not shared
    store.send(loan({ homeValue: 360_000, currentMonthlyPmi: 120 }));
    const withPmi = { ...shared.change()!.loan };
    store.send(loan({ currentBalance: 290_000, homeValue: 360_000 }));
    const noPmiGiven = shared.change()!.loan.monthlyPmi;
    store.send(loan({ currentBalance: 280_000 }));

    expect(withPmi).toEqual(expect.objectContaining({ homeValue: 360_000, monthlyPmi: 120 }));
    expect(noPmiGiven).toBe(0);
    expect(shared.change()!.loan).toEqual(expect.objectContaining({ balance: 280_000, homeValue: 360_000, monthlyPmi: 0 })); // kept
  });
});
