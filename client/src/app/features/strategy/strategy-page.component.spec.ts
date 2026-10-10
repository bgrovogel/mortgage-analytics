import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { aStrategyComparison } from '../../../testing/builders';
import { fakeCharts } from '../../../testing/fake-charts';
import { StrategyComparison, StrategyRequest } from '../../core/models/strategy.models';
import { StrategyApiService } from '../../core/services/strategy-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { StrategyPageComponent } from './strategy-page.component';
import { StrategyStore } from './strategy.store';

describe('StrategyPageComponent', () => {
  let compare: jest.Mock;
  let fixture: ComponentFixture<StrategyPageComponent>;

  beforeEach(() => {
    jest.useFakeTimers();
    compare = jest.fn().mockReturnValue(of(aStrategyComparison()));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        fakeCharts().provider,
        { provide: StrategyApiService, useValue: { compare } },
        { provide: SavedCalculationsApiService, useValue: {} },
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
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
    expect(page.querySelector('[data-testid="results"]')!.getAttribute('aria-busy')).toBe('true');
  });

  it('shows what went wrong when the server rejects the request', () => {
    compare.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { currentBalance: ['Too big.'] } } })));

    const page = open();

    expect(page.querySelector('[data-testid="calculation-errors"]')!.textContent).toContain('Too big.');
  });

  it('says the results are for the last valid inputs while a field is invalid, and which', () => {
    const page = open();
    const tax = page.querySelector('[data-testid="tax-rate"]') as HTMLInputElement;

    tax.dispatchEvent(new Event('focus'));
    tax.value = '75';
    tax.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(page.querySelector('[data-testid="stale-results"]')!.textContent).toContain('Tax rate must be between 0% and 60%.');
    expect(page.querySelector('[data-testid="recommended"]')).not.toBeNull(); // the last results stay, clearly marked

    tax.value = '24';
    tax.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(page.querySelector('[data-testid="stale-results"]')).toBeNull();
  });

  it('offers to save the comparison, with a suggested name', () => {
    const page = open();
    (page.querySelector('[data-testid="save-open"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Signed out, Save first asks to sign in; the payload and the name are ready for when they do.
    expect(page.querySelector('[data-testid="save-sign-in"]')).not.toBeNull();
    const store = TestBed.inject(StrategyStore);
    expect(store.savePayload()).toEqual({ strategy: compare.mock.calls[0][0] });
    expect(store.suggestedName()).toBe('Pay off or invest: $1,000/mo, 6.5% mortgage');
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
