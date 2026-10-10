import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { aStrategyComparison } from '../../../testing/builders';
import { fakeCharts } from '../../../testing/fake-charts';
import { StrategyComparison, StrategyRequest } from '../../core/models/strategy.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { StrategyPageComponent } from './strategy-page.component';
import { StrategyStore } from './strategy.store';

describe('StrategyPageComponent', () => {
  let compare: jest.Mock;
  let fixture: ComponentFixture<StrategyPageComponent>;

  beforeEach(() => {
    jest.useFakeTimers();
    compare = jest.fn().mockReturnValue(of(aStrategyComparison()));
    TestBed.configureTestingModule({ providers: [fakeCharts().provider, { provide: StrategyApiService, useValue: { compare } }] });
  });
  afterEach(() => jest.useRealTimers());

  const open = () => {
    fixture = TestBed.createComponent(StrategyPageComponent);
    fixture.detectChanges();
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('compares the typical household as soon as it opens', () => {
    const page = open();

    expect(compare).toHaveBeenCalledTimes(1);
    expect(page.querySelector('[data-testid="recommended"]')!.textContent).toContain('Invest the difference');
  });

  it('shows a placeholder until the first comparison arrives', () => {
    compare.mockReturnValue(new Subject<StrategyComparison>());

    const page = open();

    expect(page.textContent).toContain('Playing out 30 years');
    expect(page.querySelector('[data-testid="strategy-results"]')!.getAttribute('aria-busy')).toBe('true');
  });

  it('shows what went wrong when the server rejects the request', () => {
    compare.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { currentBalance: ['Too big.'] } } })));

    const page = open();

    expect(page.querySelector('[data-testid="strategy-errors"]')!.textContent).toContain('Too big.');
  });

  it('resumes the last comparison after a trip to another page', () => {
    open();
    const first = compare.mock.calls[0][0] as StrategyRequest;
    fixture.destroy();

    open();

    expect(TestBed.inject(StrategyStore).request()).toEqual(first);
    expect(compare).toHaveBeenLastCalledWith(first); // the form starts from the same inputs
  });
});

describe('StrategyApiService', () => {
  it('posts the request to the versioned strategies endpoint', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const request = { currentBalance: 300_000 } as StrategyRequest;

    TestBed.inject(StrategyApiService).compare(request).subscribe();

    const call = http.expectOne('/api/v1/strategies/compare');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toBe(request);
    call.flush({});
    http.verify();
  });
});
