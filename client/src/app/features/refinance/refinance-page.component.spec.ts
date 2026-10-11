import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { aRefinanceResponse } from '../../../testing/builders';
import { fakeCharts } from '../../../testing/fake-charts';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { signal } from '@angular/core';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { provideRouter } from '@angular/router';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { RefinancePageComponent } from './refinance-page.component';
import { RefinanceStore } from './refinance.store';

describe('RefinancePageComponent', () => {
  let analyze: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    analyze = jest.fn().mockReturnValue(of(aRefinanceResponse()));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        fakeCharts().provider,
        { provide: RefinanceApiService, useValue: { analyze } },
        { provide: SavedCalculationsApiService, useValue: {} }, { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
  });
  afterEach(() => jest.useRealTimers());

  let fixture: ComponentFixture<RefinancePageComponent>;
  const open = () => {
    fixture = TestBed.createComponent(RefinancePageComponent);
    fixture.detectChanges();
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('compares the worked example as soon as it opens', () => {
    const page = open();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(page.querySelector('[data-testid="refi-verdict"]')!.textContent).toContain('Refinancing costs $17,415 more');
  });

  it('shows a placeholder until the first comparison arrives', () => {
    analyze.mockReturnValue(new Subject<RefinanceResponse>());

    const page = open();

    expect(page.textContent).toContain('Comparing your loans');
    expect(page.querySelector('[data-testid="results"]')!.getAttribute('aria-busy')).toBe('true');
  });

  it('shows what went wrong when the server rejects the request', () => {
    analyze.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { currentBalance: ['Too big.'] } } })));

    const page = open();

    expect(page.querySelector('[data-testid="calculation-errors"]')!.textContent).toContain('Too big.');
  });

  it('starts from the last comparison, so leaving the page and coming back keeps it', () => {
    const previous: RefinanceRequest = {
      currentBalance: 123_000, currentAnnualInterestRate: 7, remainingTermInMonths: 120, nextPaymentDate: null,
      newAnnualInterestRate: 6, newTermInMonths: 120, closingCosts: 0, financeClosingCosts: false, originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
    };
    TestBed.inject(RefinanceStore).send(previous);

    open();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze.mock.calls[0][0]).toEqual(previous);
  });

  it('says the results are for the last valid inputs while a field is invalid, like every page', () => {
    const page = open();
    const rate = page.querySelector('[data-testid="new-rate"]') as HTMLInputElement;

    rate.dispatchEvent(new Event('focus'));
    rate.value = '40';
    rate.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(page.querySelector('[data-testid="stale-results"]')!.textContent).toContain('New rate must be between 0% and 30%.');
    expect(page.querySelector('[data-testid="error-new-rate"]')!.textContent).toBe('New rate must be between 0% and 30%.');
  });

  it('offers to save the comparison, suggesting a name built from the two rates', () => {
    TestBed.overrideProvider(AuthService, { useValue: { user: signal({ email: 'alice@example.com' }) } });
    const page = open();

    (page.querySelector('[data-testid="save-open"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((page.querySelector('[data-testid="save-name"]') as HTMLInputElement).value).toBe('Refinance 7% → 6%, 30 yr');
  });
});
