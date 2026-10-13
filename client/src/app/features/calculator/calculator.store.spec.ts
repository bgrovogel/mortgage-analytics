import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { aResponse, aSavings } from '../../../testing/builders';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { SavedCalculation } from '../../core/models/saved-calculation.models';
import { RefinanceRequest } from '../../core/models/refinance.models';
import { firstOfMonthFromNext, loanToday } from '../../core/loans/loan-progress';
import { SharedLoan, SharedLoanStore } from '../../core/state/shared-loan.store';
import { CalculatorStore, RECALCULATE_DELAY_MS, monthlyPmiOf } from './calculator.store';

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

  it('starts with the headline not yet seen, so phones show no summary bar before it is measured', () => {
    expect(store.headlineVisible()).toBe(false);
  });

  /**
   * Whether a change on the calculator is shared with the other pages. A loan the calculator holds as closely as it
   * can (its term in whole years) is not shared back, or its rounding would change the loan everywhere else.
   */
  describe('sharing its loan', () => {
    const nextMonth = firstOfMonthFromNext(0);
    const loan = (overrides: Partial<AmortizationRequest> = {}) => ({
      homePrice: 375_000, downPayment: 75_000, annualInterestRate: 6.5, termInMonths: 360, firstPaymentDate: nextMonth,
      buydown: null, adjustableRate: null, housingCosts: null, ...overrides,
    }) as unknown as AmortizationRequest;
    const shared: SharedLoan = { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 360, homeValue: 375_000, rate: { kind: 'fixed' } };

    /** Another page shares `loan`; the calculator shows its own example, then changes to `request`. Was it shared? */
    function sharesAfter(request: AmortizationRequest, loan: SharedLoan = shared): boolean {
      const sharedLoan = TestBed.inject(SharedLoanStore);
      sharedLoan.update(loan, 'Pay off or invest');
      store.send({ ...request, homePrice: 999_999 });
      store.send(request);
      return sharedLoan.change()!.from === 'Calculator';
    }

    it('does not share back the loan it was given', () => {
      expect(sharesAfter(loan())).toBe(false);
    });

    it.each([
      ['another rate', { annualInterestRate: 6.6 }],
      ['another term', { termInMonths: 348 }],
      ['a balance a dollar away', { downPayment: 74_999 }],
      ['the same balance on another price', { homePrice: 380_000, downPayment: 80_000 }],
      ['a buydown for a fixed rate', { buydown: { yearlyReductions: [2, 1] } }],
    ])('shares %s', (_, change) => {
      expect(sharesAfter(loan(change as Partial<AmortizationRequest>))).toBe(true);
    });

    it.each([
      ['a balance within a dollar', { downPayment: 74_999.5 }, shared],
      ['any price, for a loan with no home value', { homePrice: 500_000, downPayment: 200_000 }, { ...shared, homeValue: null }],
      ['a price at the balance, when that is more than the home is worth', { homePrice: 300_000, downPayment: 0 }, { ...shared, homeValue: 250_000 }],
    ])('holds %s as the same loan', (_, change, given) => {
      expect(sharesAfter(loan(change), given)).toBe(false);
    });

    it('shares no start for a new loan, which has made no payments yet', () => {
      const sharedLoan = TestBed.inject(SharedLoanStore);
      store.send(loan());
      store.send(loan({ annualInterestRate: 7 }));

      expect(sharedLoan.change()!.loan.start).toBeNull();
    });

    describe('a loan already being paid', () => {
      const started = loan({ firstPaymentDate: '2021-11-01' });
      const start = { amount: 300_000, termInMonths: 360, firstPaymentDate: '2021-11-01' };
      const today = loanToday(started, new Date());
      const sharedStarted: SharedLoan = { ...shared, balance: today.balance, remainingTermInMonths: today.monthsLeft, homeValue: 1, start };

      it('is held as it started, so it is not shared back', () => {
        expect(sharesAfter(started, sharedStarted)).toBe(false);
      });

      it('is held by its balance today when the start is not known, whatever its home is worth now', () => {
        expect(sharesAfter(started, { ...sharedStarted, start: null })).toBe(false);
      });

      it.each([
        ['another first payment', { firstPaymentDate: '2021-12-01' }],
        ['another amount', { downPayment: 70_000 }],
        ['another rate', { annualInterestRate: 6.25 }],
        ['another term', { termInMonths: 300 }],
      ])('shares %s', (_, change) => {
        expect(sharesAfter({ ...started, ...change } as AmortizationRequest, sharedStarted)).toBe(true);
      });
    });
  });
});

describe('monthlyPmiOf', () => {
  const fivePercentDown = { homePrice: 375_000, downPayment: 18_750, housingCosts: { pmiRate: 0.5 } } as AmortizationRequest;

  it('is the yearly rate on the loan, a twelfth a month, when more than 80% is borrowed', () => {
    expect(monthlyPmiOf(fivePercentDown)).toBe(148.44); // 0.5% of $356,250 / 12
  });

  it('is 0 with 20% down, or no PMI rate', () => {
    expect(monthlyPmiOf({ ...fivePercentDown, downPayment: 75_000 })).toBe(0);
    expect(monthlyPmiOf({ ...fivePercentDown, housingCosts: null })).toBe(0);
    expect(monthlyPmiOf({ ...fivePercentDown, housingCosts: { ...fivePercentDown.housingCosts!, pmiRate: 0 } })).toBe(0);
  });

  it('is not said for FHA or VA, whose mortgage insurance is not PMI', () => {
    expect(monthlyPmiOf({ ...fivePercentDown, program: { type: 'Fha' } } as AmortizationRequest)).toBeNull();
    expect(monthlyPmiOf({ ...fivePercentDown, program: { type: 'Conventional' } } as AmortizationRequest)).toBe(148.44);
  });
});
