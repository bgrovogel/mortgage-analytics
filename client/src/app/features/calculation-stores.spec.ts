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
    inputs: kind === 'Purchase' ? purchase : null,
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
      expect(call).toHaveBeenCalledWith(request);
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
        loan: { balance: 300_000, annualInterestRate: 6, remainingTermInMonths: 360, homeValue: 375_000 },
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

    it('treats opening a saved calculation as choosing its loan', () => {
      refinancePage().send(refinance);
      strategyPage().send({ ...strategy, currentBalance: 300_000, annualInterestRate: 7, remainingTermInMonths: 300 });

      stores.of('Purchase').open(saved('Purchase', 'p'));

      expect(strategyPage().loanToApply()!.loan).toEqual(
        { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 360, homeValue: 375_000 });
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
