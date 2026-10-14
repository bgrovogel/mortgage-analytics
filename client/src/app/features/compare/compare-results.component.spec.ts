import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { aHousingCosts, aPayment, aPurchase, aResponse, aSavings, aSchedule } from '../../../testing/builders';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { RECALCULATE_DELAY_MS } from '../../core/state/latest-request';
import { ComparisonStore } from './comparison.store';
import { CompareResultsComponent } from './compare-results.component';

describe('CompareResultsComponent', () => {
  /** A home at a price, with a first payment; its five years cost $500 of housing and a thousandth of the price in interest. */
  const home = (price: number, payment: number): AmortizationResponse => aResponse({
    purchase: aPurchase({ homePrice: price, downPayment: price / 10, downPaymentPercent: 10, loanAmount: price * 0.9 }),
    baseline: aSchedule({ monthlyPayment: payment - 500, totalMonthlyPayment: payment, monthlyHousingCosts: aHousingCosts({ total: 500 }) }),
    accelerated: aSchedule({ interestYouPay: price / 2, payments: [aPayment(1, { interest: price / 1_000, housingCosts: 500 })] }),
    savings: aSavings({ acceleratedPayoffDate: '2051-01-01' }),
  });
  const responses: Record<number, AmortizationResponse> = {
    400_000: home(400_000, 3_000), 450_000: home(450_000, 3_350.5), 380_000: home(380_000, 2_900), 500_000: home(500_000, 3_700),
  };

  function render(...prices: number[]) {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [{ provide: AmortizationApiService, useValue: { calculate: (r: AmortizationRequest) => of(responses[r.homePrice]) } }],
    });
    TestBed.inject(ComparisonStore).send({ homes: prices.map((homePrice) => ({ homePrice }) as AmortizationRequest) });
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    jest.useRealTimers();
    const fixture = TestBed.createComponent(CompareResultsComponent);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const text = (id: string) => page.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const row = (label: string) => [...page.querySelectorAll('tbody tr')].find((r) => r.querySelector('th')?.firstChild?.textContent?.trim() === label);
    /** A row's figures, each without the difference under it. */
    const figures = (label: string) => [...row(label)!.querySelectorAll('td')].map((cell) => cell.firstChild?.textContent?.trim());
    /** A row's differences from Home A, one for each other home (blank when there is none). */
    const differences = (label: string) => [...row(label)!.querySelectorAll('td')].slice(1).map((cell) => cell.querySelector('small')?.textContent ?? '');
    /** The homes marked best on a row, by column. */
    const best = (label: string) => [...row(label)!.querySelectorAll('td')].map((cell, i) => (cell.classList.contains('best') ? i : -1)).filter((i) => i >= 0);
    return { page, text, figures, differences, best };
  }

  describe('two homes', () => {
    it('sums up what Home B costs more or less', () => {
      expect(render(400_000, 450_000).text('compare-headline')).toBe('Home B costs $350.50 a month more, and costs $50 more over the first 5 years.');
    });

    it('puts them side by side, with Home B’s difference under each amount', () => {
      const { page, figures, differences } = render(400_000, 450_000);

      expect([...page.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual(['Home A', 'Home B']);
      expect(figures('Home price')).toEqual(['$400,000', '$450,000']);
      expect(differences('Home price')).toEqual(['+$50,000']);
      expect(figures('Monthly payment')).toEqual(['$3,000', '$3,350.50']);
      expect(differences('Monthly payment')).toEqual(['+$350.50']);
      expect(figures('Paid off')).toEqual(['Jan 2051', 'Jan 2051']);
      expect(differences('Paid off')).toEqual(['']);
    });

    it('has no list of homes to go through one by one', () => {
      expect(render(400_000, 450_000).text('compare-each')).toBeUndefined();
    });
  });

  it('shows one home without a summary, rather than failing', () => {
    const { text, figures } = render(400_000);

    expect(text('compare-headline')).toBe('');
    expect(figures('Home price')).toEqual(['$400,000']);
  });

  describe('four homes', () => {
    it('names the cheapest over five years, then measures each against Home A', () => {
      const { text, page } = render(400_000, 450_000, 380_000, 500_000);

      expect(text('compare-headline')).toBe('Home C costs the least over the first 5 years: $20 less than Home A, the next.');
      expect([...page.querySelectorAll('[data-testid="compare-each"] li')].map((li) => li.textContent?.trim())).toEqual([
        'Home B costs $350.50 a month more, and costs $50 more over the first 5 years.',
        'Home C costs $100.00 a month less, and costs $20 less over the first 5 years.',
        'Home D costs $700.00 a month more, and costs $100 more over the first 5 years.',
      ]);
    });

    it('has a column for each, with its difference from Home A', () => {
      const { page, figures, differences } = render(400_000, 450_000, 380_000, 500_000);

      expect([...page.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual(['Home A', 'Home B', 'Home C', 'Home D']);
      expect(figures('Home price')).toEqual(['$400,000', '$450,000', '$380,000', '$500,000']);
      expect(differences('Home price')).toEqual(['+$50,000', '−$20,000', '+$100,000']);
    });

    it('marks the best home on each row where lower or higher is better, and none where they are level', () => {
      const { best } = render(400_000, 450_000, 380_000, 500_000);

      expect(best('Monthly payment')).toEqual([2]);
      expect(best('Interest over the loan')).toEqual([2]);
      expect(best('Home price')).toEqual([]);
      expect(best('Housing costs')).toEqual([]);
    });
  });
});
