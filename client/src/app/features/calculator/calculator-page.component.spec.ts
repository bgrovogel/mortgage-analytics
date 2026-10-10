import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { aResponse, aSavings, aSchedule } from '../../../testing/builders';
import { fakeCharts } from '../../../testing/fake-charts';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { CalculatorPageComponent, RECALCULATE_DELAY_MS } from './calculator-page.component';

describe('CalculatorPageComponent', () => {
  let fixture: ComponentFixture<CalculatorPageComponent>;
  let page: CalculatorPageComponent;
  let calculate: jest.Mock;

  const request = (monthlyAmount = 1) => ({ homePrice: 1, extraPayments: { monthlyAmount } }) as AmortizationRequest;

  /** Lets the debounce elapse and re-renders. */
  const settle = () => {
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    fixture.detectChanges();
  };

  /** Creates the page. The form submits its defaults on load; that request is sent once the debounce elapses. */
  const create = (firstResponse: ReturnType<AmortizationApiService['calculate']>) => {
    calculate = jest.fn().mockReturnValueOnce(firstResponse);
    TestBed.configureTestingModule({
      providers: [fakeCharts().provider, { provide: AmortizationApiService, useValue: { calculate } }],
    });
    fixture = TestBed.createComponent(CalculatorPageComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  describe('debouncing', () => {
    it('waits for a pause in typing before calling the API', () => {
      create(new Subject<AmortizationResponse>());

      expect(calculate).not.toHaveBeenCalled();

      settle();
      expect(calculate).toHaveBeenCalledTimes(1);
    });

    it('sends only the latest of several quick changes', () => {
      create(of(aResponse()));
      calculate.mockReturnValue(of(aResponse()));

      page.calculate(request(1));
      page.calculate(request(2));
      page.calculate(request(3));
      settle();

      expect(calculate).toHaveBeenCalledTimes(1);
      expect(calculate.mock.calls[0][0].extraPayments.monthlyAmount).toBe(3);
    });

    it('stays busy when an earlier response arrives while a newer change is still waiting', () => {
      const inFlight = new Subject<AmortizationResponse>();
      create(inFlight);
      settle(); // request A is now in flight

      page.calculate(request(2)); // change B, still inside its debounce window
      inFlight.next(aResponse()); // A answers before B has even been sent

      expect(page.busy()).toBe(true);
    });

    it('shows that results are updating from the first keystroke, not only once the request starts', () => {
      create(of(aResponse()));
      settle();
      expect(page.busy()).toBe(false);

      page.calculate(request());

      expect(page.busy()).toBe(true);
    });
  });

  describe('results', () => {
    it('shows a placeholder until the first result arrives', () => {
      create(new Subject<AmortizationResponse>());
      settle();

      expect(page.busy()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Calculating your schedule');
    });

    it('shows the result and clears the busy flag when the API answers', () => {
      const response = aResponse({ savings: aSavings({ netSavings: 1_234 }) });

      create(of(response));
      settle();

      expect(page.result()).toBe(response);
      expect(page.busy()).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="net-savings"]').textContent).toContain('$1,234');
    });

    it('keeps the payment and savings in view on small screens, in a sticky summary bar', () => {
      create(of(aResponse({ baseline: aSchedule({ totalMonthlyPayment: 3_455.39 }), savings: aSavings({ netSavings: 114_699 }) })));
      settle();

      const bar = fixture.nativeElement.querySelector('[data-testid="summary-bar"]').textContent.replace(/\s+/g, ' ');
      expect(bar).toContain('$3,455/mo');
      expect(bar).toContain('Save $114,699');
    });

    it('puts the headline numbers before the form in reading order, so a phone shows the answer first', () => {
      create(of(aResponse()));
      settle();

      const headline = fixture.nativeElement.querySelector('app-savings-summary') as HTMLElement;
      const form = fixture.nativeElement.querySelector('[data-testid="form-panel"]') as HTMLElement;
      expect(headline.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows the charts over time in one tabbed card, beside the payment breakdown', () => {
      create(of(aResponse()));
      settle();

      const charts = fixture.nativeElement.querySelector('.charts') as HTMLElement;
      expect(charts.querySelector('app-payment-breakdown')).not.toBeNull();
      expect(charts.querySelector('app-trends [role="tablist"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('canvas').length).toBe(1); // one chart at a time
    });

    it('marks the results region busy for assistive technology while updating', () => {
      create(new Subject<AmortizationResponse>());
      settle();

      expect(fixture.nativeElement.querySelector('[data-testid="results"]').getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('errors', () => {
    it('shows the problem messages when the API rejects the request', () => {
      const problem = new HttpErrorResponse({ status: 400, error: { errors: { downPayment: ['Too big.'] } } });

      create(throwError(() => problem));
      settle();

      expect(page.errors()).toEqual(['Too big.']);
      expect(page.busy()).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="error-summary"]').textContent).toContain('Too big.');
    });

    it('recovers after a failure: the next request still runs and clears the errors', () => {
      create(throwError(() => new HttpErrorResponse({ status: 0 })));
      settle();
      calculate.mockReturnValueOnce(of(aResponse()));

      page.calculate(request());
      settle();

      expect(page.errors()).toEqual([]);
      expect(page.result()).not.toBeNull();
    });

    it('ignores a slow response once a newer request has been made', () => {
      const slow = new Subject<AmortizationResponse>();
      const fresh = aResponse({ savings: aSavings({ netSavings: 2 }) });
      create(slow);
      settle();
      calculate.mockReturnValueOnce(of(fresh));

      page.calculate(request());
      settle();
      slow.next(aResponse({ savings: aSavings({ netSavings: 1 }) }));

      expect(page.result()).toBe(fresh);
    });
  });
});
