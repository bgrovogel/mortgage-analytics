import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { aRefinanceResponse } from '../../../testing/builders';
import { fakeCharts } from '../../../testing/fake-charts';
import { RefinanceRequest, RefinanceResponse } from '../../core/models/refinance.models';
import { RefinanceApiService } from '../../core/services/refinance-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { RefinancePageComponent } from './refinance-page.component';
import { RefinanceStore } from './refinance.store';

describe('RefinancePageComponent', () => {
  let analyze: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    analyze = jest.fn().mockReturnValue(of(aRefinanceResponse()));
    TestBed.configureTestingModule({ providers: [fakeCharts().provider, { provide: RefinanceApiService, useValue: { analyze } }] });
  });
  afterEach(() => jest.useRealTimers());

  const open = () => {
    const fixture = TestBed.createComponent(RefinancePageComponent);
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
    expect(page.querySelector('[data-testid="refinance-results"]')!.getAttribute('aria-busy')).toBe('true');
  });

  it('shows what went wrong when the server rejects the request', () => {
    analyze.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { currentBalance: ['Too big.'] } } })));

    const page = open();

    expect(page.querySelector('[data-testid="refinance-errors"]')!.textContent).toContain('Too big.');
  });

  it('starts from the last comparison, so leaving the page and coming back keeps it', () => {
    const previous: RefinanceRequest = {
      currentBalance: 123_000, currentAnnualInterestRate: 7, remainingTermInMonths: 120, nextPaymentDate: null,
      newAnnualInterestRate: 6, newTermInMonths: 120, closingCosts: 0, financeClosingCosts: false,
    };
    TestBed.inject(RefinanceStore).analyze(previous);

    open();

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze.mock.calls[0][0]).toEqual(previous);
  });
});
