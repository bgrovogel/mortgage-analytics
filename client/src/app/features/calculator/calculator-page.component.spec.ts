import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { aResponse, aSavings } from '../../../testing/builders';
import { fakeCharts } from '../../../testing/fake-charts';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { CalculatorPageComponent } from './calculator-page.component';

describe('CalculatorPageComponent', () => {
  let fixture: ComponentFixture<CalculatorPageComponent>;
  let page: CalculatorPageComponent;
  let calculate: jest.Mock;

  const request = { homePrice: 1 } as AmortizationRequest;

  /** Creates the page; the form submits its defaults on load, so `calculate` is called once immediately. */
  const create = (firstResponse: ReturnType<AmortizationApiService['calculate']>) => {
    calculate = jest.fn().mockReturnValueOnce(firstResponse);
    TestBed.configureTestingModule({
      providers: [fakeCharts().provider, { provide: AmortizationApiService, useValue: { calculate } }],
    });
    fixture = TestBed.createComponent(CalculatorPageComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('shows a placeholder until the first result arrives', () => {
    create(new Subject<AmortizationResponse>());

    expect(page.busy()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Calculating your schedule');
  });

  it('shows the result and clears the busy flag when the API answers', () => {
    const response = aResponse({ savings: aSavings({ netSavings: 1_234 }) });

    create(of(response));
    fixture.detectChanges();

    expect(page.result()).toBe(response);
    expect(page.busy()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="net-savings"]').textContent).toContain('$1,234');
  });

  it('shows the problem messages when the API rejects the request', () => {
    const problem = new HttpErrorResponse({ status: 400, error: { errors: { downPayment: ['Too big.'] } } });

    create(throwError(() => problem));
    fixture.detectChanges();

    expect(page.errors()).toEqual(['Too big.']);
    expect(page.busy()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="error-summary"]').textContent).toContain('Too big.');
  });

  it('recovers after a failure: the next request still runs and clears the errors', () => {
    create(throwError(() => new HttpErrorResponse({ status: 0 })));
    calculate.mockReturnValueOnce(of(aResponse()));

    page.calculate(request);

    expect(page.errors()).toEqual([]);
    expect(page.result()).not.toBeNull();
  });

  it('ignores a slow response once a newer request has been made', () => {
    const slow = new Subject<AmortizationResponse>();
    const fresh = aResponse({ savings: aSavings({ netSavings: 2 }) });
    create(slow);
    calculate.mockReturnValueOnce(of(fresh));

    page.calculate(request);
    slow.next(aResponse({ savings: aSavings({ netSavings: 1 }) }));

    expect(page.result()).toBe(fresh);
  });
});
