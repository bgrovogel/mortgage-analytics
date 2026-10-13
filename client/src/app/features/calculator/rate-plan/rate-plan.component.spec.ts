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
    const table = () => Array.from(root.querySelectorAll('[data-testid="buydown-years"] tr'),
      (tr) => Array.from(tr.querySelectorAll('th, td'), (cell) => cell.textContent!.replace(/\s+/g, ' ').trim()));
    return { text, rows, table };
  };

  it('shows nothing for a fixed rate', () => {
    expect(render(aResponse()).text('rate-plan')).toBeUndefined();
  });

  it("lists every year of a buydown: the rate, the whole payment, and what the buydown pays, then the total", () => {
    const { text, table } = render(aResponse({
      buydown: {
        noteRate: 5.99,
        years: [
          { year: 1, annualInterestRate: 3.99, monthlyPayment: 1_698.74, subsidy: 5_218.44 },
          { year: 2, annualInterestRate: 4.99, monthlyPayment: 1_910.25, subsidy: 2_680.32 },
          { year: 3, annualInterestRate: 5.99, monthlyPayment: 2_133.61, subsidy: 0 },
        ],
        totalSubsidy: 7_898.76, paidBy: 'Seller',
      },
      baseline: aSchedule({ payments: Array.from({ length: 36 }, (_, i) => aPayment(i + 1, { housingCosts: [994.27, 1_010.5, 1_027][Math.floor(i / 12)] })) }),
    }));

    expect(text('rate-plan')).toContain('2-1 buydown');
    expect(table()).toEqual([
      ['Year', 'Rate', 'Each month', 'Buydown pays'],
      ['Year 1', '3.99%', '$2,693.01 $1,698.74 P&I', '$5,218 $434.87/mo'],
      ['Year 2', '4.99%', '$2,920.75 $1,910.25 P&I', '$2,680 $223.36/mo'],
      ['From year 3', '5.99%', '$3,160.61 $2,133.61 P&I', 'Nothing'],
      ['In all', '', '', '$7,899'],
    ]);
    expect(text('buydown-cost')).toContain('The seller or builder pays $7,899 up front');
    expect(text('buydown-cost')).toContain('you pay $7,899 less interest over the loan');
    expect(text('buydown-cost')).toContain('The loan itself is at 5.99% throughout');
  });

  it('shows the principal and interest alone when the loan has no housing costs', () => {
    const { table } = render(aResponse({
      buydown: {
        noteRate: 6, totalSubsidy: 1_505.52, paidBy: 'Seller',
        years: [{ year: 1, annualInterestRate: 5, monthlyPayment: 1_073.64, subsidy: 1_505.52 }, { year: 2, annualInterestRate: 6, monthlyPayment: 1_199.1, subsidy: 0 }],
      },
      baseline: aSchedule({ payments: Array.from({ length: 24 }, (_, i) => aPayment(i + 1, { housingCosts: 0 })) }),
    }));

    expect(table()[1]).toEqual(['Year 1', '5%', '$1,073.64', '$1,506 $125.46/mo']);
  });

  it('says a buydown you pay for at closing changes when you pay, not how much', () => {
    const { text } = render(aResponse({
      buydown: {
        noteRate: 5.99,
        years: [
          { year: 1, annualInterestRate: 3.99, monthlyPayment: 1_698.74, subsidy: 5_218.44 },
          { year: 2, annualInterestRate: 4.99, monthlyPayment: 1_910.25, subsidy: 2_680.32 },
          { year: 3, annualInterestRate: 5.99, monthlyPayment: 2_133.61, subsidy: 0 },
        ],
        totalSubsidy: 7_898.76, paidBy: 'Borrower',
      },
    }));

    expect(text('buydown-cost')).toContain('You pay $7,899 at closing');
    expect(text('buydown-cost')).toContain('back as lower payments over 2 years');
    expect(text('buydown-cost')).toContain('it changes when you pay, not how much');
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
