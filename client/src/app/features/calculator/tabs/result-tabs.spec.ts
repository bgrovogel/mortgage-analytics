import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aResponse } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { CalculatorStore, RECALCULATE_DELAY_MS } from '../calculator.store';
import { AmortizationRequest, AmortizationResponse } from '../../../core/models/amortization.models';
import { of } from 'rxjs';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { Affordability, CashToClose, SellerOfferComparison } from '../../../core/models/amortization.models';
import { AffordabilityTabComponent } from './affordability-tab.component';
import { ClosingTabComponent } from './closing-tab.component';
import { OverviewTabComponent } from './overview-tab.component';
import { ProjectionTabComponent } from './projection-tab.component';
import { ScheduleTabComponent } from './schedule-tab.component';

/** The routed result tabs. Each reads the current result from the store. */
describe('result tabs', () => {
  let store: CalculatorStore;
  let charts: ReturnType<typeof fakeCharts>;
  let response: AmortizationResponse;

  beforeEach(() => {
    response = aResponse();
    jest.useFakeTimers();
    charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider, { provide: AmortizationApiService, useValue: { calculate: () => of(response) } }] });
    store = TestBed.inject(CalculatorStore);
    store.send({} as AmortizationRequest);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
  });
  afterEach(() => jest.useRealTimers());

  const render = <T>(component: Type<T>) => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return fixture;
  };
  const captions = (root: HTMLElement) => [...root.querySelectorAll('figcaption, h2')].map((e) => e.textContent!.trim());

  describe('Overview', () => {
    it('shows the headline numbers, the payment breakdown and the balance chart', () => {
      const root = render(OverviewTabComponent).nativeElement as HTMLElement;

      expect(root.querySelector('app-savings-summary')).not.toBeNull();
      expect(root.querySelector('app-payment-breakdown')).not.toBeNull();
      expect(root.querySelector('[data-testid="balance-chart"]')).not.toBeNull();
    });

    it('leaves the cash to close and the seller’s money to the Closing tab', () => {
      const root = render(OverviewTabComponent).nativeElement as HTMLElement;

      expect(root.querySelector('app-cash-to-close')).toBeNull();
      expect(root.querySelector('app-seller-offer')).toBeNull();
      expect(root.querySelector('app-affordability')).toBeNull();
    });

    it('has a place for the loan program, which says nothing for a conventional loan', () => {
      const root = render(OverviewTabComponent).nativeElement as HTMLElement;

      expect(root.querySelector('app-program-summary')).not.toBeNull();
      expect(root.querySelector('[data-testid="program-summary"]')).toBeNull();
    });

    it('has a place for discount points, which says nothing without them', () => {
      const root = render(OverviewTabComponent).nativeElement as HTMLElement;

      expect(root.querySelector('app-points-summary')).not.toBeNull();
      expect(root.querySelector('[data-testid="points-summary"]')).toBeNull();
    });

    it('tells the store while the headline is on screen, and that it is gone once the tab closes', () => {
      const fixture = render(OverviewTabComponent);

      fixture.componentInstance.headlineVisible(true);
      expect(store.headlineVisible()).toBe(true);

      fixture.destroy();
      expect(store.headlineVisible()).toBe(false);
    });
  });

  /** Sends a request whose result is `changes` on top of the default. */
  const answer = (changes: Partial<AmortizationResponse>) => {
    response = aResponse(changes);
    store.send({ homePrice: 1 } as AmortizationRequest);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
  };

  describe('Affordability', () => {
    it('measures the home against the income and debts, once they are given', () => {
      answer({ affordability: {
        monthlyIncome: 12_500, monthlyDebts: 600, housingPayment: 3_102.19, housingPercent: 24.82, totalPercent: 29.62,
        comfortable: { housingPercent: 28, totalPercent: 36, maxHousingPayment: 3_500, maxHomePrice: 474_091, fits: true },
        mostAllowed: { housingPercent: null, totalPercent: 45, maxHousingPayment: 5_025, maxHomePrice: 700_615, fits: true },
      } as Affordability });
      const root = render(AffordabilityTabComponent).nativeElement as HTMLElement;

      expect(root.querySelector('[data-testid="affordability"]')).not.toBeNull();
      expect(root.querySelector('[data-testid="affordability-empty"]')).toBeNull();
    });

    it('without an income, says what it would show, and opens the income field', () => {
      const root = render(AffordabilityTabComponent).nativeElement as HTMLElement;
      (root.querySelector('[data-testid="add-income"]') as HTMLButtonElement).click();

      expect(root.querySelector('[data-testid="affordability-empty"]')?.textContent).toContain('the way a lender');
      expect(TestBed.inject(FormNavigator).requested()).toEqual({ section: 'income', field: 'annual-income' });
    });
  });

  describe('Closing', () => {
    const cash = {
      downPayment: 18_750, loanCosts: 4_000, otherFees: 1_000, dailyInterest: 63.44, prepaidInterestDays: 15, prepaidInterest: 951.6,
      homeownersInsurance: 2_400, monthlyEscrow: 795.83, escrowMonths: 3, escrowDeposit: 2_387.49, buydownCost: 0, discountPoints: 0, upfrontMortgageFee: 0,
      closingCosts: 10_739.09, sellerCredits: 0, lenderCredits: 0, credits: 0, unusedCredits: 0, total: 29_489.09,
      concessions: { limitPercent: 3, limit: 11_250, sellerBuydown: 0, total: 0, overLimit: 0, normalClosingCostsExcluded: false, nextTier: null },
    } as CashToClose;
    const offer = {
      offer: 5_000, yearsKept: 7, rateCutPerPoint: 0.25, best: 'ClosingCosts',
      options: [{ use: 'ClosingCosts', homePrice: 1, loanAmount: 1, annualInterestRate: 6, points: 0, firstPayment: 1, laterPayment: 1, cashToClose: 1, payments: 1, balance: 1, cost: 1, notUsed: 0 }],
    } as SellerOfferComparison;

    it('shows the cash to close, line by line', () => {
      answer({ cashToClose: cash });

      expect(render(ClosingTabComponent).nativeElement.querySelector('[data-testid="cash-to-close-total"]')?.textContent).toBe('$29,489.09');
    });

    it('weighs the seller’s offer, and weighs it again when its settings change', () => {
      answer({ cashToClose: cash, sellerOffer: offer });
      const fixture = render(ClosingTabComponent);
      const years = fixture.nativeElement.querySelector('[data-testid="years-kept"]') as HTMLInputElement;

      years.value = '10';
      years.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="seller-offer"]')).not.toBeNull();
      expect(store.offerSettings()).toEqual({ yearsKept: 10, rateCutPerPoint: 0.25 });
    });

    it('without an offer, says what it would show, and opens the seller credits', () => {
      answer({ cashToClose: cash });
      const root = render(ClosingTabComponent).nativeElement as HTMLElement;
      (root.querySelector('[data-testid="add-seller-credits"]') as HTMLButtonElement).click();

      expect(root.querySelector('[data-testid="seller-offer-empty"]')).not.toBeNull();
      expect(TestBed.inject(FormNavigator).requested()).toEqual({ section: 'closing', field: 'closing-credits' });
    });
  });

  describe('Projection', () => {
    it('shows the yearly costs, the home value and the equity, as three charts', () => {
      const root = render(ProjectionTabComponent).nativeElement as HTMLElement;

      expect(captions(root)).toEqual(['Projected yearly taxes & costs', 'Home value, and what each tax is charged on', 'Equity: what is yours, and what is owed']);
      expect(root.querySelectorAll('canvas')).toHaveLength(3);
    });

    it('gives the quick numbers above the charts, for the year clicked on the costs chart', () => {
      const fixture = render(ProjectionTabComponent);
      const root = fixture.nativeElement as HTMLElement;
      const costsChart = charts.config(0);

      (costsChart.options!.onClick as unknown as (event: unknown, elements: { index: number }[]) => void)({}, [{ index: 2 }]);
      fixture.detectChanges();

      expect(root.firstElementChild?.querySelector('app-cost-totals')).not.toBeNull(); // the numbers come first
      expect(root.querySelector<HTMLSelectElement>('[data-testid="cost-totals-year"]')!.value).toBe('3');
    });
  });

  describe('Schedule', () => {
    it('shows the amortization table', () => {
      const root = render(ScheduleTabComponent).nativeElement as HTMLElement;

      expect(root.querySelector('[data-testid="schedule-table"]')).not.toBeNull();
    });
  });
});
