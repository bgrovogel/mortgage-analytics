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

  describe('what the affordability question starts from', () => {
    it('is a home in mind, until the visitor chooses a budget', () => {
      expect(store.affordStart()).toBe('home');

      store.affordStart.set('budget');

      expect(store.affordStart()).toBe('budget');
    });
  });

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
    const saved: SavedCalculation = { id: 'abc', name: 'Oak St', kind: 'Purchase', inputs: request(42), otherHomes: null, refinance: null, strategy: null, createdAt: '', updatedAt: '' };

    it('is not linked to a saved calculation at first', () => {
      expect(store.saved()).toBeNull();
    });

    it('opens a saved calculation: its inputs become the request, and it is calculated', () => {
      calculate.mockReturnValue(of(aResponse()));

      store.open(saved);
      settle();

      // Weighed by the current settings for the seller's offer, which a save made before them leaves out.
      const sent = { ...saved.inputs, sellerOffer: { yearsKept: 7, rateCutPerPoint: 0.25 }, rentOrBuy: null, sale: { sellingCostPercent: 6, filingStatus: 'Single', gainsTaxRatePercent: 15, valueChangesPercent: [-3, 0] }, rental: null, secondLoan: null };
      expect(store.request()).toEqual(sent);
      expect(calculate).toHaveBeenCalledWith(sent);
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

  describe('weighing the seller’s offer', () => {
    beforeEach(() => calculate.mockReturnValue(of(aResponse())));

    it('weighs it over seven years, a quarter point off for each point, unless set', () => {
      store.send(request());

      expect(store.request()?.sellerOffer).toEqual({ yearsKept: 7, rateCutPerPoint: 0.25 });
    });

    it('calculates again when the settings change, and keeps them for the requests after', () => {
      store.send(request());
      settle();

      store.setOfferSettings({ yearsKept: 10, rateCutPerPoint: 0.375 });
      settle();
      store.send(request(5));

      expect(calculate.mock.calls.map(([r]) => r.sellerOffer?.yearsKept)).toEqual([7, 10]);
      expect(store.request()?.sellerOffer).toEqual({ yearsKept: 10, rateCutPerPoint: 0.375 });
    });

    it('takes the settings a saved calculation brings', () => {
      store.send({ ...request(), sellerOffer: { yearsKept: 3, rateCutPerPoint: 0.125 } });

      expect(store.offerSettings()).toEqual({ yearsKept: 3, rateCutPerPoint: 0.125 });
    });

    it('waits for a first request before calculating anything', () => {
      store.setOfferSettings({ yearsKept: 10, rateCutPerPoint: 0.25 });
      settle();

      expect(calculate).not.toHaveBeenCalled();
    });
  });

  describe('weighing buying against renting', () => {
    beforeEach(() => calculate.mockReturnValue(of(aResponse())));
    const rent = { monthlyRent: 2_100, rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6 };

    it('asks for nothing until a rent is given', () => {
      store.send(request());

      expect(store.request()?.rentOrBuy).toBeNull();
    });

    it('calculates again with a rent, and keeps it for the requests after, until it is cleared', () => {
      store.send(request());
      settle();
      store.setRentSettings(rent);
      settle();
      store.send(request(5));
      expect(store.request()?.rentOrBuy).toEqual(rent);

      store.setRentSettings(null);
      expect(store.request()?.rentOrBuy).toBeNull();
    });

    it('takes the rent a saved calculation brings, with the value scenarios it was made with', () => {
      store.send({ ...request(), rentOrBuy: { ...rent, valueChangesPercent: [-6, 0] } });

      expect(store.rentSettings()).toEqual({ ...rent, valueChangesPercent: [-6, 0] });
    });

    it('gives a saved calculation made before value scenarios the usual ones', () => {
      store.send({ ...request(), rentOrBuy: rent });

      expect(store.rentSettings()).toEqual({ ...rent, valueChangesPercent: [-3, 0] });
    });
  });

  describe('weighing a second loan against PMI', () => {
    beforeEach(() => calculate.mockReturnValue(of(aResponse())));
    const second = { amount: 25_000, annualInterestRate: 8, termInMonths: 180, yearsKept: 7 };

    it('asks for nothing until one is tried', () => {
      store.send(request());

      expect(store.request()?.secondLoan).toBeNull();
    });

    it('calculates again with a second loan, keeps it for the requests after, and drops it when stopped', () => {
      store.send(request());
      settle();
      store.setSecondLoanSettings(second);
      settle();
      store.send(request(5));
      expect(store.request()?.secondLoan).toEqual(second);

      store.setSecondLoanSettings(null);
      expect(store.request()?.secondLoan).toBeNull();
    });

    it('takes the second loan a saved calculation brings', () => {
      store.send({ ...request(), secondLoan: second });

      expect(store.secondLoanSettings()).toEqual(second);
    });
  });

  describe('measuring a rental', () => {
    beforeEach(() => calculate.mockReturnValue(of(aResponse())));
    const rental = { monthlyRent: 2_500, vacancyPercent: 5, managementPercent: 8, maintenancePercent: 1, rentIncreasePercent: 3 };

    it('asks for nothing until a rent is given', () => {
      store.send(request());

      expect(store.request()?.rental).toBeNull();
    });

    it('calculates again with a rent, and keeps it for the requests after, until it is cleared', () => {
      store.send(request());
      settle();
      store.setRentalSettings(rental);
      settle();
      store.send(request(5));
      expect(store.request()?.rental).toEqual(rental);

      store.setRentalSettings(null);
      expect(store.request()?.rental).toBeNull();
    });

    it('takes the rent a saved calculation brings', () => {
      store.send({ ...request(), rental });

      expect(store.rentalSettings()).toEqual(rental);
    });
  });

  describe('weighing a sale', () => {
    beforeEach(() => calculate.mockReturnValue(of(aResponse())));
    const sale = { sellingCostPercent: 8, filingStatus: 'MarriedFilingJointly' as const, gainsTaxRatePercent: 20 };

    it('asks for a sale with the usual costs and tax rate, so the view always has figures', () => {
      store.send(request());

      expect(store.request()?.sale).toEqual({ sellingCostPercent: 6, filingStatus: 'Single', gainsTaxRatePercent: 15, valueChangesPercent: [-3, 0] });
    });

    it('calculates again with other costs, and keeps them for the requests after', () => {
      store.send(request());
      settle();
      store.setSaleSettings(sale);
      settle();
      store.send(request(5));

      expect(store.request()?.sale).toEqual(sale);
    });

    it('takes the settings a saved calculation brings', () => {
      store.send({ ...request(), sale: { ...sale, valueChangesPercent: [-6, 0] } });

      expect(store.saleSettings()).toEqual({ ...sale, valueChangesPercent: [-6, 0] });
    });

    it('gives a saved calculation made before value scenarios the usual ones', () => {
      store.send({ ...request(), sale });

      expect(store.saleSettings()).toEqual({ ...sale, valueChangesPercent: [-3, 0] });
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
