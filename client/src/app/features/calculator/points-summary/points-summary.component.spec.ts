import { TestBed } from '@angular/core/testing';
import { aResponse, aSchedule } from '../../../../testing/builders';
import { DiscountPointsSummary } from '../../../core/models/amortization.models';
import { PointsSummaryComponent } from './points-summary.component';

describe('PointsSummaryComponent', () => {
  /** The reference loan, $200,000 at 6%, bought down with one point from 6.25% (tools/calculator-check). */
  const onePoint: DiscountPointsSummary = {
    points: 1, cost: 2_000, rateWithoutPoints: 6.25, paymentWithoutPoints: 1_231.43, monthlySaving: 32.33,
    interestSaved: 11_642.09, netSaving: 9_642.09, breakEvenPayment: 48, breakEvenDate: '2030-10-01',
  };

  const render = (points: DiscountPointsSummary | null) => {
    const fixture = TestBed.createComponent(PointsSummaryComponent);
    fixture.componentRef.setInput('result', aResponse({ baseline: aSchedule({ monthlyPayment: 1_199.1 }), discountPoints: points }));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    return { text, rows: () => Array.from(root.querySelectorAll('li'), (li) => li.textContent!.replace(/\s+/g, ' ').trim()) };
  };

  it('shows nothing without points', () => {
    expect(render(null).text('points-summary')).toBeUndefined();
  });

  it('sets the payment with the points beside the payment without them', () => {
    expect(render(onePoint).rows()).toEqual(['Without points6.25%$1,231.43/mo', 'With 1 point$1,199.10/mo']);
  });

  it('says what they cost, when they pay for themselves, and what they save', () => {
    expect(render(onePoint).text('points-verdict')).toBe(
      '1 point costs $2,000 at closing and lowers the payment $32.33 a month. The interest it saves covers that by '
      + 'payment 48 (Oct 2030), and over the whole loan it saves $9,642 after its cost. Sell or refinance before then, '
      + 'and it costs more than it saved.');
  });

  it('says plainly when they never pay for themselves', () => {
    const { text } = render({ ...onePoint, points: 2, cost: 4_000, interestSaved: 1_234, netSaving: -2_766, breakEvenPayment: null, breakEvenDate: null });

    expect(text('points-verdict')).toBe(
      '2 points cost $4,000 at closing and lower the payment $32.33 a month. At this price they never pay for '
      + 'themselves: over the whole loan they save $1,234 of interest, less than they cost.');
  });
});
