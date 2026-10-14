import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { aHousingCosts, aPayment, aPurchase, aResponse, aSavings, aSchedule } from '../../../../testing/builders';
import { AmortizationRequest, AmortizationResponse } from '../../../core/models/amortization.models';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { RECALCULATE_DELAY_MS } from '../../../core/state/latest-request';
import { ComparisonStore } from '../comparison.store';
import { CompareTabComponent } from './compare-tab.component';

describe('CompareTabComponent', () => {
  const home = (price: number, payment: number): AmortizationResponse => aResponse({
    purchase: aPurchase({ homePrice: price, downPayment: price / 10, downPaymentPercent: 10, loanAmount: price * 0.9 }),
    baseline: aSchedule({ monthlyPayment: payment - 500, totalMonthlyPayment: payment, monthlyHousingCosts: aHousingCosts({ total: 500 }) }),
    accelerated: aSchedule({ interestYouPay: price / 2, payments: [aPayment(1, { interest: 100, housingCosts: 500 })] }),
    savings: aSavings({ acceleratedPayoffDate: '2051-01-01' }),
  });

  function render() {
    jest.useFakeTimers();
    const responses: Record<number, AmortizationResponse> = { 400_000: home(400_000, 3_000), 450_000: home(450_000, 3_350.5) };
    TestBed.configureTestingModule({
      providers: [{ provide: AmortizationApiService, useValue: { calculate: (r: AmortizationRequest) => of(responses[r.homePrice]) } }],
    });
    TestBed.inject(ComparisonStore).send({ first: { homePrice: 400_000 } as AmortizationRequest, second: { homePrice: 450_000 } as AmortizationRequest });
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    jest.useRealTimers();
    const fixture = TestBed.createComponent(CompareTabComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** A row's cells, each trimmed, joined by spaces; the row is found by its label (without the note under it). */
  const row = (page: HTMLElement, label: string) => {
    const found = [...page.querySelectorAll('tbody tr')].find((r) => r.querySelector('th')?.firstChild?.textContent?.trim() === label);
    return found && [label, ...[...found.querySelectorAll('td')].map((cell) => cell.firstChild?.textContent?.trim())].filter(Boolean).join(' ');
  };

  it('sums up what the second home costs more or less', () => {
    expect(render().querySelector('[data-testid="compare-headline"]')?.textContent?.trim())
      .toBe('Home B costs $350.50 a month more, and costs the same over the first 5 years.');
  });

  it('puts the two homes side by side, with the difference for each amount', () => {
    const page = render();

    expect(row(page, 'Home price')).toBe('Home price $400,000 $450,000 +$50,000');
    expect(row(page, 'Monthly payment')).toBe('Monthly payment $3,000 $3,350.50 +$350.50');
    expect(row(page, 'Paid off')).toBe('Paid off Jan 2051 Jan 2051');
    expect(row(page, 'Mortgage insurance ends')).toBe('Mortgage insurance ends None None');
    // A phone has no Difference column: each difference is also under Home B's figure, shown there instead.
    expect([...page.querySelectorAll('td small.under')].map((s) => s.textContent)).toEqual(['+$50,000', '+$5,000', '+$45,000', '+$350.50', '+$350.50', '+$25,000']);
  });
});
