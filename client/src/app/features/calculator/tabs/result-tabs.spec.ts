import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aResponse } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { CalculatorStore, RECALCULATE_DELAY_MS } from '../calculator.store';
import { AmortizationRequest, AmortizationResponse } from '../../../core/models/amortization.models';
import { of } from 'rxjs';
import { OverviewTabComponent } from './overview-tab.component';
import { ProjectionTabComponent } from './projection-tab.component';
import { ScheduleTabComponent } from './schedule-tab.component';

/** The three routed result tabs. Each reads the current result from the store. */
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

    it('shows the cash to close when the request had closing costs, and only then', () => {
      expect(render(OverviewTabComponent).nativeElement.querySelector('app-cash-to-close')).toBeNull();

      response = aResponse({ cashToClose: {
        downPayment: 18_750, loanCosts: 4_000, otherFees: 1_000, dailyInterest: 63.44, prepaidInterestDays: 15, prepaidInterest: 951.6,
        homeownersInsurance: 2_400, monthlyEscrow: 795.83, escrowMonths: 3, escrowDeposit: 2_387.49, buydownCost: 0, discountPoints: 0, upfrontMortgageFee: 0,
        closingCosts: 10_739.09, credits: 0, unusedCredits: 0, total: 29_489.09,
      } });
      store.send({ homePrice: 1 } as AmortizationRequest);
      jest.advanceTimersByTime(RECALCULATE_DELAY_MS);

      expect(render(OverviewTabComponent).nativeElement.querySelector('[data-testid="cash-to-close-total"]')?.textContent).toBe('$29,489.09');
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
