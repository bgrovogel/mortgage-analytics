import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AmortizationRequest } from '../core/models/amortization.models';
import { RefinanceRequest } from '../core/models/refinance.models';
import { SavedCalculation } from '../core/models/saved-calculation.models';
import { StrategyRequest } from '../core/models/strategy.models';
import { AmortizationApiService } from '../core/services/amortization-api.service';
import { RefinanceApiService } from '../core/services/refinance-api.service';
import { StrategyApiService } from '../core/services/strategy-api.service';
import { RECALCULATE_DELAY_MS } from '../core/state/latest-request';
import { SharedInputs, readShareLink } from '../core/state/share-link';
import { CalculationStores } from './calculation-stores';
import { CalculatorStore } from './calculator/calculator.store';
import { RefinanceStore } from './refinance/refinance.store';
import { StrategyStore } from './strategy/strategy.store';

describe('CalculationStores', () => {
  const purchase = { homePrice: 375_000, downPayment: 75_000, annualInterestRate: 6.5, termInMonths: 360 } as AmortizationRequest;
  const refinance = {
    currentBalance: 300_000, currentAnnualInterestRate: 7, newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000,
    financeClosingCosts: false,
  } as RefinanceRequest;
  const strategy = { currentBalance: 300_000, annualInterestRate: 6.5, monthlyCashToPutToWork: 1_000, riskProfile: 'Balanced' } as StrategyRequest;
  const saved = (kind: SavedCalculation['kind'], id: string): SavedCalculation => ({
    id, name: `${kind} ${id}`, kind, createdAt: '', updatedAt: '',
    inputs: kind === 'Purchase' || kind === 'HomeComparison' ? purchase : null,
    otherHomes: kind === 'HomeComparison' ? [{ ...purchase, homePrice: 450_000 }] : null,
    refinance: kind === 'Refinance' ? refinance : null,
    strategy: kind === 'Strategy' ? strategy : null,
  });

  let stores: CalculationStores;
  const calls = { calculate: jest.fn(), analyze: jest.fn(), compare: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers();
    Object.values(calls).forEach((call) => call.mockReset().mockReturnValue(of({})));
    TestBed.configureTestingModule({
      providers: [
        { provide: AmortizationApiService, useValue: { calculate: calls.calculate } },
        { provide: RefinanceApiService, useValue: { analyze: calls.analyze } },
        { provide: StrategyApiService, useValue: { compare: calls.compare } },
      ],
    });
    stores = TestBed.inject(CalculationStores);
  });
  afterEach(() => jest.useRealTimers());

  it('opens each kind on its own page, with its own inputs, and only there', () => {
    for (const [kind, route, call, request] of [
      ['Purchase', ['/calculator', 'overview'], calls.calculate, purchase],
      ['Refinance', ['/refinance'], calls.analyze, refinance],
      ['Strategy', ['/strategy'], calls.compare, strategy],
    ] as const) {
      const store = stores.of(kind);
      store.open(saved(kind, kind));
      jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

      expect(store.route).toEqual(route);
      // A purchase is sent weighing a seller's offer the usual way, which the calculator adds to every request.
      expect(call).toHaveBeenCalledWith(kind === 'Purchase' ? { ...request, sellerOffer: { yearsKept: 7, rateCutPerPoint: 0.25 }, rentOrBuy: null } : request);
      expect(store.saved()).toEqual({ id: kind, name: `${kind} ${kind}` });
    }
    expect(calls.calculate).toHaveBeenCalledTimes(1); // the other kinds never reached the calculator
  });

  it('ignores a saved calculation of another kind', () => {
    const page = TestBed.inject(RefinanceStore);

    page.open(saved('Strategy', 's'));

    expect(page.saved()).toBeNull();
    expect(page.request()).toBeNull();
  });

  it('describes each kind in its own terms', () => {
    expect(stores.describe(saved('Purchase', '1'))).toContain('$375,000 home');
    expect(stores.describe(saved('Refinance', '2'))).toContain('$300,000 left at 7% → 6%');
    expect(stores.describe(saved('Strategy', '3'))).toContain('$1,000/mo to put to work');
    expect(stores.describe(saved('HomeComparison', '4'))).toBe('$375,000 home, 20% down at 6.5% vs $450,000 home, 16.7% down at 6.5%');
  });

  it('opens homes compared on the Compare page, and lists them under their own name', () => {
    const store = stores.of('HomeComparison');
    store.open(saved('HomeComparison', 'c'));
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

    expect(store.route).toEqual(['/compare']);
    expect(calls.calculate.mock.calls.map(([r]) => r.homePrice)).toEqual(expect.arrayContaining([375_000, 450_000]));
    expect(stores.pages().map((p) => p.pageName)).toEqual(['Calculator', 'Compare homes', 'Refinance', 'Pay off or invest']);
  });

  it('keeps a page linked to a renamed item, and unlinks it when the item is deleted or on sign-out', () => {
    const refinancePage = TestBed.inject(RefinanceStore);
    const strategyPage = TestBed.inject(StrategyStore);
    refinancePage.linkTo({ id: 'r', name: 'Old' });
    strategyPage.linkTo({ id: 's', name: 'Pay off?' });

    stores.renamed({ id: 'r', name: 'New' });
    expect(refinancePage.saved()).toEqual({ id: 'r', name: 'New' });
    expect(strategyPage.saved()).toEqual({ id: 's', name: 'Pay off?' });

    stores.deleted('r');
    expect(refinancePage.saved()).toBeNull();
    expect(strategyPage.saved()).not.toBeNull();

    stores.unlinkAll();
    expect(strategyPage.saved()).toBeNull();
    expect(TestBed.inject(CalculatorStore).saved()).toBeNull();
  });

  describe('the shared loan', () => {
    const calculator = () => TestBed.inject(CalculatorStore);
    const refinancePage = () => TestBed.inject(RefinanceStore);
    const strategyPage = () => TestBed.inject(StrategyStore);

    it("shares no page's example, only a loan the user changes, and offers it to the pages that have not seen it", () => {
      calculator().send(purchase); // the calculator opens with its example
      expect(refinancePage().loanToApply()).toBeNull();

      calculator().send({ ...purchase, annualInterestRate: 6 });

      expect(refinancePage().loanToApply()).toEqual({
        loan: { balance: 300_000, annualInterestRate: 6, remainingTermInMonths: 360, homeValue: 375_000, start: null, rate: { kind: 'fixed' }, monthlyPmi: 0 },
        from: 'Calculator',
        version: 1,
      });
      expect(calculator().loanToApply()).toBeNull(); // the page it came from is up to date
    });

    it('carries a loan changed on one page to the others, once each', () => {
      refinancePage().send({ ...refinance, currentBalance: 1 });
      refinancePage().send(refinance);
      strategyPage().send({ ...strategy, currentBalance: 300_000, annualInterestRate: 7, remainingTermInMonths: 300 });
      expect(refinancePage().loanToApply()).toBeNull(); // same balance, rate and years: nothing new

      strategyPage().send({ ...strategy, currentBalance: 250_000, annualInterestRate: 7, remainingTermInMonths: 300 });

      expect(refinancePage().loanToApply()!.loan.balance).toBe(250_000);
      expect(refinancePage().loanToApply()!.from).toBe('Pay off or invest');
      refinancePage().send({ ...refinance, currentBalance: 250_000 });
      expect(refinancePage().loanToApply()).toBeNull();
    });

    it("does not let a page's example overwrite a loan typed elsewhere", () => {
      refinancePage().send(refinance);
      refinancePage().send({ ...refinance, currentBalance: 123_000 });

      calculator().send(purchase); // the calculator opens with its own example

      expect(strategyPage().loanToApply()!.loan.balance).toBe(123_000);
    });

    it("does not send the calculator's whole-year rounding back, but does share a term the user changes there", () => {
      refinancePage().send(refinance);
      refinancePage().send({ ...refinance, remainingTermInMonths: 270 }); // 22.5 years left
      const rounded = { ...purchase, homePrice: 375_000, downPayment: 75_000, annualInterestRate: 7, termInMonths: 276 };
      calculator().send(purchase);
      calculator().send(rounded); // what the calculator holds after taking the loan: 23 years

      expect(refinancePage().loanToApply()).toBeNull();

      calculator().send({ ...rounded, termInMonths: 264 }); // the user picks 22 years

      expect(refinancePage().loanToApply()!.loan.remainingTermInMonths).toBe(264);
    });

    it("shares a loan already being paid as it stands today, and does not echo back the calculator's version of it", () => {
      jest.setSystemTime(new Date(2026, 9, 10));
      const existing = { ...purchase, homePrice: 250_000, downPayment: 50_000, annualInterestRate: 6, termInMonths: 360, firstPaymentDate: '2021-11-01' };
      calculator().send({ ...existing, annualInterestRate: 5 });
      calculator().send(existing);

      expect(refinancePage().loanToApply()!.loan).toEqual(
        { balance: 186_108.71, annualInterestRate: 6, remainingTermInMonths: 300, homeValue: 250_000, // no growth given
          start: { amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' }, rate: { kind: 'fixed' }, monthlyPmi: 0 });

      refinancePage().send(refinance);
      refinancePage().send({ ...refinance, currentBalance: 186_000, currentAnnualInterestRate: 6, remainingTermInMonths: 300 });
      // What the calculator holds once it has taken that loan: the original amount worked out back to the cent.
      calculator().send({ ...existing, downPayment: 50_116.83 });

      expect(refinancePage().loanToApply()).toBeNull();
    });

    it('hands the original loan between the calculator and Refinance without echoing it back', () => {
      jest.setSystemTime(new Date(2026, 9, 10));
      const existing = { ...purchase, homePrice: 250_000, downPayment: 50_000, annualInterestRate: 6, termInMonths: 360, firstPaymentDate: '2021-11-01' };
      calculator().send(purchase);
      calculator().send(existing);
      const start = refinancePage().loanToApply()!.loan.start;
      expect(start).toEqual({ amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' });

      // What the refinance form sends once it has taken that loan: the same original loan.
      refinancePage().send(refinance);
      refinancePage().send({ ...refinance, currentBalance: 186_108.71, currentAnnualInterestRate: 6, remainingTermInMonths: 300, originalLoan: start });

      expect(calculator().loanToApply()).toBeNull();
    });

    it('carries the rate type, counted from today, and leaves alone what a page cannot say or hold', () => {
      jest.setSystemTime(new Date(2026, 9, 10));
      const arm = { initialFixedMonths: 84, adjustmentIntervalMonths: 12, expectedRate: 8, initialCap: 2, periodicCap: 1, lifetimeCap: 5 };
      const existing = { ...purchase, homePrice: 250_000, downPayment: 50_000, annualInterestRate: 6, termInMonths: 360, firstPaymentDate: '2021-11-01' };

      // A 7/1 ARM on a loan 60 payments in: its next reset is 24 payments from today.
      calculator().send(purchase);
      calculator().send({ ...existing, adjustableRate: arm });
      expect(strategyPage().loanToApply()!.loan.rate).toEqual(
        { kind: 'arm', nextResetIn: 24, intervalMonths: 12, expectedRate: 8, initialCap: 2, periodicCap: 1, lifetimeCap: 5, margin: null });

      // A buydown chosen on Pay off or invest is kept when Refinance, which cannot hold one, changes the balance.
      strategyPage().send(strategy);
      strategyPage().send({ ...strategy, remainingTermInMonths: 360, buydown: { yearlyReductions: [2, 1] } });
      refinancePage().send(refinance);
      refinancePage().send({ ...refinance, currentBalance: 290_000 });
      expect(calculator().loanToApply()!.loan.rate).toEqual({ kind: 'buydown', yearlyReductions: [2, 1] });

      // An ARM past its first reset cannot be said from today: the rate is shared as unknown, so each page keeps its own.
      calculator().send({ ...existing, adjustableRate: { ...arm, initialFixedMonths: 36 }, homePrice: 260_000 });
      expect(strategyPage().loanToApply()!.loan.rate).toBeNull();
    });

    it('treats opening a saved calculation as choosing its loan', () => {
      refinancePage().send(refinance);
      strategyPage().send({ ...strategy, currentBalance: 300_000, annualInterestRate: 7, remainingTermInMonths: 300 });

      stores.of('Purchase').open(saved('Purchase', 'p'));

      expect(strategyPage().loanToApply()!.loan).toEqual(
        { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 360, homeValue: 375_000, start: null, rate: { kind: 'fixed' }, monthlyPmi: 0 });
    });
  });

  describe('share links', () => {
    const shared = (kind: SavedCalculation['kind']) => readShareLink(stores.of(kind).shareFragment()) as SharedInputs;

    it('shares each page’s inputs under its kind, once there are any', () => {
      expect(stores.of('Refinance').shareFragment()).toBeNull();
      TestBed.inject(RefinanceStore).send(refinance);
      TestBed.inject(StrategyStore).send(strategy);

      expect(shared('Refinance')).toEqual({ kind: 'Refinance', request: refinance });
      expect(shared('Strategy')).toEqual({ kind: 'Strategy', request: strategy });
    });

    it('leaves a household’s income and debts out of a purchase, and says so', () => {
      TestBed.inject(CalculatorStore).send({ ...purchase, affordability: { annualIncome: 150_000, monthlyDebts: 600 } });

      expect((shared('Purchase').request as AmortizationRequest).affordability).toBeNull();
      expect((shared('Purchase').request as AmortizationRequest).homePrice).toBe(375_000);
      expect(stores.of('Purchase').shareNote).toBe('Your income and debts are left out.');
      expect(stores.of('Strategy').shareNote).toBe('It includes your income and savings.');
      expect(stores.of('Refinance').shareNote).toBeNull();
    });

    it('leaves income out of every home compared', () => {
      const withIncome = { ...purchase, affordability: { annualIncome: 150_000, monthlyDebts: 600 } };
      stores.of('HomeComparison').send({ homes: [withIncome, withIncome] });

      expect((shared('HomeComparison').request as { homes: AmortizationRequest[] }).homes.map((h) => h.affordability)).toEqual([null, null]);
    });

    it('opens a shared calculation as the user’s own: not linked to a saved one, and its loan shared', () => {
      const page = TestBed.inject(RefinanceStore);
      page.linkTo({ id: 'r', name: 'Mine' });

      page.openShared(refinance);
      jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

      expect(calls.analyze).toHaveBeenCalledWith(refinance);
      expect(page.saved()).toBeNull();
      expect(TestBed.inject(StrategyStore).loanToApply()).not.toBeNull();
    });

    it('opens shared homes with the first in the calculator too', () => {
      const calculator = TestBed.inject(CalculatorStore);
      calculator.linkTo({ id: 'p', name: 'Mine' });

      stores.of('HomeComparison').openShared({ homes: [purchase, { ...purchase, homePrice: 450_000 }] });

      expect(calculator.request()!.homePrice).toBe(375_000);
      expect(calculator.saved()).toBeNull();
    });
  });

  it("offers each page's inputs to Save under the field its kind uses, with a suggested name", () => {
    TestBed.inject(RefinanceStore).send(refinance);
    TestBed.inject(StrategyStore).send(strategy);

    expect(TestBed.inject(RefinanceStore).savePayload()).toEqual({ refinance });
    expect(TestBed.inject(RefinanceStore).suggestedName()).toBe('Refinance 7% → 6%, 30 yr');
    expect(TestBed.inject(StrategyStore).savePayload()).toEqual({ strategy });
    expect(TestBed.inject(CalculatorStore).savePayload()).toBeNull(); // nothing to save yet
    expect(TestBed.inject(CalculatorStore).suggestedName()).toBe('');
  });
});
