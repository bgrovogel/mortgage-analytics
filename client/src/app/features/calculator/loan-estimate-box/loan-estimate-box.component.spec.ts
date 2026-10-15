import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { aResponse } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { LoanEstimateBoxComponent } from './loan-estimate-box.component';

describe('LoanEstimateBoxComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = (response: AmortizationResponse) => {
    const fixture = TestBed.createComponent(LoanEstimateBoxComponent);
    fixture.componentRef.setInput('result', response);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  };

  const full = aResponse({
    annualPercentageRate: 6.722,
    inFiveYears: { totalPaid: 79_848.4, principalPaidOff: 12_778.36 },
    totalInterestPercentage: 127.543,
  });

  it('shows the APR, what five years cost and pay off, and the total interest percentage, as an estimate lists them', () => {
    const text = render(full);

    expect(text('le-apr')).toBe('APR 6.722%');
    expect(text('le-paid')).toBe('In 5 years, you will have paid $79,848.40');
    expect(text('le-principal')).toBe('and paid off $12,778.36 of the principal');
    expect(text('le-tip')).toBe('Total interest percentage 127.543%');
  });

  it('says what each means, in a line', () => {
    const text = render(full);

    expect(text('le-apr-note')).toContain('rate counting the lender’s fees');
    expect(text('le-paid-note')).toContain('principal, interest, mortgage insurance and the lender’s loan costs');
    expect(text('le-tip-note')).toContain('interest over the whole loan as a share of the amount borrowed');
  });

  it('leaves out what the response does not have', () => {
    const text = render(aResponse({ annualPercentageRate: null, inFiveYears: null, totalInterestPercentage: null }));

    expect(text('le-apr')).toBeUndefined();
    expect(text('le-paid')).toBeUndefined();
    expect(text('le-tip')).toBeUndefined();
  });
});
