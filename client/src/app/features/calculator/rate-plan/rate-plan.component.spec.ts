import { TestBed } from '@angular/core/testing';
import { aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { RatePlanComponent } from './rate-plan.component';

describe('RatePlanComponent', () => {
  const render = (result: AmortizationResponse) => {
    const fixture = TestBed.createComponent(RatePlanComponent);
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const rows = () => Array.from(root.querySelectorAll('li'), (li) => li.textContent!.replace(/\s+/g, ' ').trim());
    return { text, rows };
  };

  it('shows nothing for a fixed rate', () => {
    expect(render(aResponse()).text('rate-plan')).toBeUndefined();
  });

  it("lists a buydown's years, then the note rate, and what the buydown costs", () => {
    const { text, rows } = render(aResponse({
      buydown: {
        noteRate: 5.99,
        years: [
          { year: 1, annualInterestRate: 3.99, monthlyPayment: 1_698.74 },
          { year: 2, annualInterestRate: 4.99, monthlyPayment: 1_910.25 },
          { year: 3, annualInterestRate: 5.99, monthlyPayment: 2_133.61 },
        ],
        totalSubsidy: 7_898.76,
      },
    }));

    expect(text('rate-plan')).toContain('2-1 buydown');
    expect(rows()).toEqual(['Year 13.99%$1,698.74/mo', 'Year 24.99%$1,910.25/mo', 'From year 35.99%$2,133.61/mo']);
    expect(text('buydown-cost')).toContain('The buydown costs $7,899');
    expect(text('buydown-cost')).toContain('The loan itself is at 5.99% throughout');
  });

  it("lists an adjustable rate's resets on the expected path, and warns of the worst case", () => {
    const payments = [aPayment(1, { dueDate: '2026-01-01', annualInterestRate: 6 })];
    const reset = { paymentNumber: 85, effectiveDate: '2033-01-01', previousRate: 6, newRate: 7.5, previousPayment: 1_199.1, newPayment: 1_365.01 };
    const { text, rows } = render(aResponse({
      baseline: aSchedule({ totalInterest: 277_467.08 }),
      accelerated: aSchedule({ monthlyPayment: 1_199.1, payments, rateChanges: [reset] }),
      adjustableRate: {
        worstCaseRateChanges: [{ ...reset, newRate: 11, newPayment: 1_787.42 }],
        worstCasePeakPayment: 1_787.42,
        worstCaseTotalInterest: 394_058.09,
      },
    }));

    expect(rows()).toEqual(['Jan 2026 to Dec 20326%$1,199.10/mo', 'From Jan 20337.5%$1,365.01/mo']);
    expect(text('arm-worst-case')).toBe(
      'If rates rise as far as the caps allow, the rate reaches 11% by Jan 2033 and the payment $1,787.42 a month (without extra payments): '
      + '$394,058 of interest over the loan, against $277,467 on the path you expect.');
  });
});
