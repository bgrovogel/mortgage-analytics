import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { aHousingCosts, aResponse, aSchedule, aSavings } from '../../../testing/builders';
import { fakeCharts } from '../../../testing/fake-charts';
import { routes } from '../../app.routes';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { signal } from '@angular/core';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { CalculatorStore, RECALCULATE_DELAY_MS } from './calculator.store';
import { ComparisonStore } from './comparison.store';

describe('CalculatorPageComponent', () => {
  let harness: RouterTestingHarness;
  let calculate: jest.Mock<Observable<AmortizationResponse>, [AmortizationRequest]>;

  beforeEach(() => {
    jest.useFakeTimers();
    calculate = jest.fn().mockReturnValue(of(aResponse()));
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), fakeCharts().provider, { provide: SavedCalculationsApiService, useValue: {} }, { provide: AuthService, useValue: { user: signal(null) } }, { provide: AmortizationApiService, useValue: { calculate } }],
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

  it('links to each result tab, and shows the one for the URL', async () => {
    await open('/calculator/schedule');

    const links = [...harness.routeNativeElement!.querySelectorAll('nav[aria-label="Results"] a')] as HTMLAnchorElement[];
    expect(links.map((a) => [a.textContent!.trim(), a.getAttribute('href')])).toEqual([
      ['Overview', '/calculator/overview'],
      ['Projection', '/calculator/projection'],
      ['Schedule', '/calculator/schedule'],
      ['Compare', '/calculator/compare'],
    ]);
    expect(el('app-schedule-tab')).not.toBeNull();
    expect(el('app-overview-tab')).toBeNull();
  });

  describe('comparing two homes', () => {
    const switchTo = (house: 'a' | 'b' | 'c' | 'd') => {
      el(`[data-testid="edit-home-${house}"]`)!.dispatchEvent(new Event('change'));
      harness.detectChanges();
      jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
      harness.detectChanges();
    };
    const homePrice = () => el('[data-testid="home-price"]') as HTMLInputElement;
    const type = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
      harness.detectChanges();
    };

    it('shows the switch between the homes only on the Compare tab, and starts Home B as a copy of Home A', async () => {
      await open('/calculator/overview');
      expect(el('[data-testid="house-switch"]')).toBeNull();

      await harness.navigateByUrl('/calculator/compare');
      jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
      harness.detectChanges();
      const comparison = TestBed.inject(ComparisonStore);

      expect(el('[data-testid="house-switch"]')).not.toBeNull();
      expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home A');
      expect(comparison.request()!.homes).toEqual([comparison.request()!.homes[0], comparison.request()!.homes[0]]);
    });

    it('edits Home B in the same place, leaving Home A as it was, and only Home A is the shared loan', async () => {
      await open('/calculator/compare');
      const first = TestBed.inject(CalculatorStore).request();

      switchTo('b');
      expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home B');
      expect(el('[data-testid="shared-tag"]')).toBeNull();
      type(homePrice(), '450000');

      const comparison = TestBed.inject(ComparisonStore).request()!;
      expect(comparison.homes[1].homePrice).toBe(450_000);
      expect(comparison.homes[0]).toBe(first);
      expect(TestBed.inject(CalculatorStore).request()).toBe(first);

      switchTo('a');
      expect(homePrice().value).toBe(first!.homePrice.toLocaleString('en-US'));
    });

    it('adds homes up to four, each a copy of Home A to edit, then offers no more', async () => {
      await open('/calculator/compare');
      const click = (id: string) => {
        (el(`[data-testid="${id}"]`) as HTMLButtonElement).click();
        harness.detectChanges();
        jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
        harness.detectChanges();
      };

      click('add-home');
      expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home C');
      type(homePrice(), '380000');
      click('add-home');

      const comparison = TestBed.inject(ComparisonStore).request()!;
      expect(comparison.homes.map((h) => h.homePrice)).toEqual([415_000, 415_000, 380_000, 415_000]);
      expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home D');
      expect(el('[data-testid="edit-home-d"]')).not.toBeNull();
      expect(el('[data-testid="add-home"]')).toBeNull();
    });

    it('removes the home being edited, never Home A, and keeps at least two', async () => {
      await open('/calculator/compare');
      expect(el('[data-testid="remove-home"]')).toBeNull();
      (el('[data-testid="add-home"]') as HTMLButtonElement).click();
      harness.detectChanges();
      type(homePrice(), '380000');
      expect(el('[data-testid="remove-home"]')!.textContent?.trim()).toBe('Remove Home C');

      (el('[data-testid="remove-home"]') as HTMLButtonElement).click();
      harness.detectChanges();
      jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
      harness.detectChanges();

      expect(TestBed.inject(ComparisonStore).request()!.homes.map((h) => h.homePrice)).toEqual([415_000, 415_000]);
      expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home B');
      expect(el('[data-testid="remove-home"]')).toBeNull();
      switchTo('a');
      expect(el('[data-testid="remove-home"]')).toBeNull();
    });

    it('saves the comparison on the Compare tab, and the purchase on the others', async () => {
      await open('/calculator/compare');
      expect(TestBed.inject(ComparisonStore).savePayload()).toEqual(expect.objectContaining({ otherHomes: [expect.anything()] }));
      expect(el('app-compare-tab')).not.toBeNull();
    });
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
