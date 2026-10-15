import { TestBed } from '@angular/core/testing';
import { aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { RateWhatIfComponent } from './rate-what-if.component';

describe('RateWhatIfComponent', () => {
  /** The reference loan: $200,000 at 6% over 30 years, $1,199.10 a month (tools/calculator-check). */
  const referenceLoan = (overrides: Partial<AmortizationResponse> = {}) => aResponse({
    purchase: { ...aResponse().purchase, loanAmount: 200_000 },
    baseline: aSchedule({ payments: Array.from({ length: 360 }, (_, i) => aPayment(i + 1, { annualInterestRate: 6 })) }),
    ...overrides,
  });

  const render = (result: AmortizationResponse) => {
    const fixture = TestBed.createComponent(RateWhatIfComponent);
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const find = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const text = (id: string) => find(id)?.textContent?.replace(/\s+/g, ' ').trim();
    const slideTo = (value: number) => {
      const slider = find('what-if-slider') as HTMLInputElement;
      slider.value = String(value);
      slider.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { find, text, slideTo, fixture };
  };

  it('starts at the loan as it is: its rate and payment, and nothing changed', () => {
    const { text } = render(referenceLoan());

    expect(text('what-if-rate')).toBe('6%');
    expect(text('what-if-payment')).toBe('$1,199.10/mo');
    expect(text('what-if-payment-change')).toBe('As it is now');
  });

  it('prices a rate half a point higher: the payment and the interest over the loan', () => {
    const { text, slideTo } = render(referenceLoan());

    slideTo(0.5);

    expect(text('what-if-rate')).toBe('6.5%');
    expect(text('what-if-payment')).toBe('$1,264.14/mo');
    expect(text('what-if-payment-change')).toBe('+$65.04 a month');
    expect(text('what-if-interest')).toBe('$255,090');
    expect(text('what-if-interest-change')).toBe('+$23,414 over the loan');
  });

  it('prices a lower rate as a saving', () => {
    const { text, slideTo } = render(referenceLoan());

    slideTo(-0.5);

    expect(text('what-if-rate')).toBe('5.5%');
    expect(text('what-if-payment-change')).toMatch(/^−\$\d+\.\d\d a month$/);
    expect(text('what-if-interest-change')).toMatch(/^−\$[\d,]+ over the loan$/);
  });

  it('says what a quarter point is worth on this loan', () => {
    expect(render(referenceLoan()).text('what-if-note')).toBe(
      'Each quarter of a point on this loan is about $32.33 a month. Principal and interest only, paid on schedule.');
  });

  it('can go back to the loan as it is', () => {
    const { text, find, slideTo, fixture } = render(referenceLoan());
    slideTo(1);
    expect(find('what-if-reset')).not.toBeNull();

    find('what-if-reset')!.click();
    fixture.detectChanges();

    expect(text('what-if-rate')).toBe('6%');
    expect(find('what-if-reset')).toBeNull();
  });

  it('is left out where one rate does not describe the loan', () => {
    const arm = referenceLoan({ adjustableRate: { worstCaseRateChanges: [], worstCasePeakPayment: 0, worstCaseTotalInterest: 0 } });

    expect(render(arm).find('rate-what-if')).toBeNull();
  });
});
