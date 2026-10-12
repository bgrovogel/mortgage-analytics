import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { aResponse } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { CalculatorStore, RECALCULATE_DELAY_MS } from '../calculator.store';
import { AmortizationRequest } from '../../../core/models/amortization.models';
import { of } from 'rxjs';
import { OverviewTabComponent } from './overview-tab.component';
import { ProjectionTabComponent } from './projection-tab.component';
import { ScheduleTabComponent } from './schedule-tab.component';

/** The three routed result tabs. Each reads the current result from the store. */
describe('result tabs', () => {
  let store: CalculatorStore;
  let charts: ReturnType<typeof fakeCharts>;

  beforeEach(() => {
    jest.useFakeTimers();
    charts = fakeCharts();
    TestBed.configureTestingModule({ providers: [charts.provider, { provide: AmortizationApiService, useValue: { calculate: () => of(aResponse()) } }] });
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

    it('tells the store while the headline is on screen, and that it is gone once the tab closes', () => {
      const fixture = render(OverviewTabComponent);

      fixture.componentInstance.headlineVisible(true);
      expect(store.headlineVisible()).toBe(true);

      fixture.destroy();
      expect(store.headlineVisible()).toBe(false);
    });
  });

  describe('Projection', () => {
    it('shows the yearly costs and the home value side by side, as two charts', () => {
      const root = render(ProjectionTabComponent).nativeElement as HTMLElement;

      expect(captions(root)).toEqual(['Projected yearly taxes & costs', 'Home value, and what each tax is charged on']);
      expect(root.querySelectorAll('canvas')).toHaveLength(2);
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
