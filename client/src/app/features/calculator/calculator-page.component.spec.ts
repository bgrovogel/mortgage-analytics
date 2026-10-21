import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { aHousingCosts, aResponse, aSchedule, aSavings } from '../../../testing/builders';
import { routes } from '../../app.routes';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { signal } from '@angular/core';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { CalculatorStore, RECALCULATE_DELAY_MS } from './calculator.store';

describe('CalculatorPageComponent', () => {
  let harness: RouterTestingHarness;
  let calculate: jest.Mock<Observable<AmortizationResponse>, [AmortizationRequest]>;

  beforeEach(() => {
    jest.useFakeTimers();
    calculate = jest.fn().mockReturnValue(of(aResponse()));
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: SavedCalculationsApiService, useValue: {} }, { provide: AuthService, useValue: { user: signal(null) } }, { provide: AmortizationApiService, useValue: { calculate } }],
    });
  });
  afterEach(() => jest.useRealTimers());

  /** Opens a URL, then lets the form's first calculation through the debounce. */
  const open = async (url: string) => {
    harness = await RouterTestingHarness.create(url);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    harness.detectChanges();
  };
  const el = (selector: string) => harness.routeNativeElement!.querySelector(selector) as HTMLElement | null;

  it('opens on the overview tab', async () => {
    await open('/calculator');

    expect(el('app-overview-tab')).not.toBeNull();
    expect(el('[data-testid="result-tab-overview"]')!.getAttribute('aria-current')).toBe('page');
  });

  it('puts the rent, for the rent or buy question, above the optional details, as the income is on the afford view', async () => {
    await open('/calculator/rent-or-buy');

    const rent = el('[data-testid="rent-settings"]')!;
    const more = el('[data-testid="more-details"]')!;
    expect(rent.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sends an old link to the Compare tab to the Compare page', async () => {
    await open('/calculator/compare');

    expect(TestBed.inject(Router).url).toBe('/compare');
  });

  it('links to each result tab, and shows the one for the URL', async () => {
    await open('/calculator/schedule');

    const names = (label: string) => [...harness.routeNativeElement!.querySelectorAll(`nav[aria-label="${label}"] a`)]
      .map((a) => [a.textContent!.trim(), a.getAttribute('href')]);
    expect(names('Results')).toEqual([
      ['Cost', '/calculator/overview'],
      ['Can I afford it?', '/calculator/affordability'],
      ['Rent or buy?', '/calculator/rent-or-buy'],
      ['Compare', '/compare'],
    ]);
    expect(names('Go deeper')).toEqual([
      ['← Back to Cost', '/calculator/overview'], // on a view under Cost, the way back comes first
      ['Closing costs', '/calculator/closing'],
      ['Year by year', '/calculator/projection'],
      ['If you sell', '/calculator/sale'],
      ['Every payment', '/calculator/schedule'],
    ]);
    expect(el('app-schedule-tab')).not.toBeNull();
    expect(el('app-overview-tab')).toBeNull();
  });

  it('offers to save the calculation, beside the result tabs', async () => {
    await open('/calculator');

    expect(el('.results-header app-save-calculation')).not.toBeNull();
  });

  it('shows a placeholder until the first result arrives', async () => {
    calculate.mockReturnValue(new Subject());

    await open('/calculator');

    expect(el('app-overview-tab')).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('Calculating your schedule');
  });

  it('starts the form from the last calculation, so leaving the page and coming back keeps it', async () => {
    TestBed.inject(CalculatorStore).send({
      homePrice: 512_000, downPayment: 102_400, annualInterestRate: 6, termInMonths: 360, firstPaymentDate: null,
      strategy: 'ShortenTerm', recast: null, extraPayments: null, housingCosts: null,
    });

    await open('/calculator');

    expect(calculate).toHaveBeenCalledTimes(1);
    expect(calculate.mock.calls[0][0]).toMatchObject({ homePrice: 512_000, downPayment: 102_400 });
  });

  it('shows the problem messages when the API rejects the request', async () => {
    calculate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { downPayment: ['Too big.'] } } })));

    await open('/calculator');

    expect(el('[data-testid="calculation-errors"]')!.textContent).toContain('Too big.');
  });

  it('marks the results busy for assistive technology while updating', async () => {
    calculate.mockReturnValue(new Subject());

    await open('/calculator');

    expect(el('[data-testid="results"]')!.getAttribute('aria-busy')).toBe('true');
  });

  describe('summary bar (phones)', () => {
    it('shows the monthly payment and the savings', async () => {
      calculate.mockReturnValue(of(aResponse({ baseline: aSchedule({ totalMonthlyPayment: 3_455.39 }), savings: aSavings({ netSavings: 114_699 }) })));

      await open('/calculator');

      const bar = el('[data-testid="summary-bar"]')!.textContent!.replace(/\s+/g, ' ');
      expect(bar).toContain('$3,455/mo');
      expect(bar).not.toContain('in year 1'); // the same payment every year
      expect(bar).toContain('Net savings $114,699');
    });

    it("shows the interest instead when nothing extra is paid, and a buydown's first-year payment", async () => {
      calculate.mockReturnValue(of(aResponse({
        baseline: aSchedule({ totalMonthlyPayment: 3_246.01, totalInterest: 454_378.85, monthlyHousingCosts: aHousingCosts({ propertyTax: 994.27 }) }),
        savings: aSavings({ netSavings: 0 }),
        buydown: { noteRate: 6.5, years: [{ year: 1, annualInterestRate: 4.5, monthlyPayment: 1_805.07, subsidy: 5_564.04 }], totalSubsidy: 8_107.92, paidBy: 'Seller' },
      })));

      await open('/calculator');

      const bar = el('[data-testid="summary-bar"]')!.textContent!.replace(/\s+/g, ' ');
      expect(bar).toContain('$2,799/mo in year 1'); // $1,805.07 in year 1 + $994.27 of housing costs; it rises after
      expect(bar).toContain('Interest $454,379');
    });

    it('says the answer to the question open instead of the savings, on the views that ask another one', async () => {
      const rentOrBuy = { monthlyRent: 2_700, cashToClose: 48_128.79, breakEvenYear: 4, years: [{ year: 1, advantage: -27_228 }] };
      calculate.mockReturnValue(of(aResponse({ rentOrBuy: rentOrBuy as never })));

      await open('/calculator/rent-or-buy');

      const bar = el('[data-testid="summary-bar"]')!.textContent!.replace(/\s+/g, ' ');
      expect(el('[data-testid="summary-lead"]')!.textContent).toBe('Buy, if you stay 4 years or more');
      expect(bar).not.toContain('Net savings');
    });

    it('hides while the headline numbers are on screen, so they are not shown twice', async () => {
      await open('/calculator');

      TestBed.inject(CalculatorStore).headlineVisible.set(true);
      harness.detectChanges();
      expect(el('[data-testid="summary-bar"]')!.classList).toContain('hidden');

      TestBed.inject(CalculatorStore).headlineVisible.set(false);
      harness.detectChanges();
      expect(el('[data-testid="summary-bar"]')!.classList).not.toContain('hidden');
    });
  });
});
