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
  const home = (price: number, payment: number, extra = { monthly: 0, paidOff: '2051-01-01', insuranceEnds: null as string | null }): AmortizationResponse =>
    aResponse({
      purchase: aPurchase({ homePrice: price, downPayment: price / 10, downPaymentPercent: 10, loanAmount: price * 0.9 }),
      baseline: aSchedule({ monthlyPayment: payment - 500, totalMonthlyPayment: payment, monthlyHousingCosts: aHousingCosts({ total: 500 }) }),
      accelerated: aSchedule({
        interestYouPay: price / 2, mortgageInsuranceEndDate: extra.insuranceEnds,
        payments: [aPayment(1, { interest: price / 1_000, housingCosts: 500, extraPrincipal: extra.monthly })],
      }),
      savings: aSavings({ acceleratedPayoffDate: extra.paidOff }),
      // The APR rises with the price here (fees spread over a bigger loan would lower it; it is only a figure to compare).
      annualPercentageRate: Math.round((6 + price / 1_000_000) * 1_000) / 1_000,
    });
  const responses: Record<number, AmortizationResponse> = {
    400_000: home(400_000, 3_000), 450_000: home(450_000, 3_350.5), 380_000: home(380_000, 2_900), 500_000: home(500_000, 3_700),
    // Paying extra: $500 a month ends PMI and the loan sooner; $250 a little sooner.
    410_000: home(410_000, 3_000, { monthly: 500, paidOff: '2045-12-01', insuranceEnds: '2030-10-01' }),
    420_000: home(420_000, 3_000, { monthly: 250, paidOff: '2048-07-01', insuranceEnds: '2032-07-01' }),
    430_000: home(430_000, 3_000, { monthly: 0, paidOff: '2051-01-01', insuranceEnds: '2032-07-01' }),
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
    return { page, text, figures, differences, best, fixture };
  }

  describe('only the rows that differ', () => {
    const rowsOf = (page: HTMLElement) => [...page.querySelectorAll('tbody tr th')].map((th) => th.firstChild?.textContent?.trim());

    it('shows every row until asked, then only those where the homes are not the same', () => {
      const { page, fixture } = render(400_000, 450_000);
      expect(rowsOf(page)).toContain('Paid off'); // the same in both homes

      const toggle = page.querySelector<HTMLInputElement>('[data-testid="only-differences"]')!;
      toggle.click();
      fixture.detectChanges();

      expect(rowsOf(page)).not.toContain('Paid off');
      expect(rowsOf(page)).not.toContain('Rate'); // the same rate in both
      expect(rowsOf(page)).toContain('Home price');
      expect(rowsOf(page)).toContain('Monthly payment');
    });

    it('brings every row back when it is turned off again', () => {
      const { page, fixture } = render(400_000, 450_000);
      const toggle = page.querySelector<HTMLInputElement>('[data-testid="only-differences"]')!;

      toggle.click();
      fixture.detectChanges();
      toggle.click();
      fixture.detectChanges();

      expect(rowsOf(page)).toContain('Paid off');
    });
  });

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

  describe('the APR', () => {
    it('shows each home’s APR, with the difference from Home A in points, and marks the lowest', () => {
      const { figures, differences, best } = render(400_000, 450_000, 380_000);

      expect(figures('APR')).toEqual(['6.4%', '6.45%', '6.38%']);
      expect(differences('APR')).toEqual(['+0.05 pt', '−0.02 pt']);
      expect(best('APR')).toEqual([2]);
    });

    it('is level when the homes are', () => {
      expect(render(400_000, 400_000).differences('APR')).toEqual(['']);
    });
  });

  describe('paying extra', () => {
    it('shows each home’s first payment with its extra principal, once any home pays extra', () => {
      const { figures, differences } = render(430_000, 410_000);

      expect(figures('With extra principal')).toEqual(['$3,000', '$3,500']);
      expect(differences('With extra principal')).toEqual(['+$500']);
    });

    it('leaves that line out when no home pays extra', () => {
      const { page } = render(400_000, 450_000);

      expect([...page.querySelectorAll('tbody th')].map((th) => th.firstChild?.textContent?.trim())).not.toContain('With extra principal');
    });

    it('says how much sooner or later mortgage insurance ends and the loan is paid off, and marks the soonest', () => {
      const { figures, differences, best } = render(430_000, 410_000, 420_000);

      expect(figures('Mortgage insurance ends')).toEqual(['Jul 2032', 'Oct 2030', 'Jul 2032']);
      expect(differences('Mortgage insurance ends')).toEqual(['1 yr 9 mo sooner', '']);
      expect(best('Mortgage insurance ends')).toEqual([1]);
      expect(figures('Paid off')).toEqual(['Jan 2051', 'Dec 2045', 'Jul 2048']);
      expect(differences('Paid off')).toEqual(['5 yr 1 mo sooner', '2 yr 6 mo sooner']);
      expect(best('Paid off')).toEqual([1]);
    });

    it('says a home without mortgage insurance has none, and compares only the dates', () => {
      const { figures, differences, best } = render(400_000, 410_000);

      expect(figures('Mortgage insurance ends')).toEqual(['None', 'Oct 2030']);
      expect(differences('Mortgage insurance ends')).toEqual(['']);
      expect(best('Mortgage insurance ends')).toEqual([]);
    });
  });

  it('leaves out the home-by-home list when every home costs the same', () => {
    const { text } = render(400_000, 400_000, 400_000);

    expect(text('compare-headline')).toBe('All 3 homes cost the same over the first 5 years.');
    expect(text('compare-each')).toBeUndefined();
  });

  describe('on a narrow screen', () => {
    it('labels each figure with its home, for the layout that stacks the homes under each line', () => {
      const { page } = render(400_000, 450_000, 380_000);
      const table = page.querySelector('table')!;

      expect(table.classList).toContain('homes-3');
      expect(table.style.getPropertyValue('--homes')).toBe('3');
      expect([...page.querySelectorAll('tbody tr:first-child td')].map((td) => td.getAttribute('data-home'))).toEqual(['Home A', 'Home B', 'Home C']);
    });
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
