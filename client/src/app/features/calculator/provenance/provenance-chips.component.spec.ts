import { TestBed } from '@angular/core/testing';
import { aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { ProvenanceChipsComponent } from './provenance-chips.component';

describe('ProvenanceChipsComponent', () => {
  const example = () => aResponse({
    baseline: aSchedule({
      monthlyPayment: 2_325.26,
      payments: [
        aPayment(1, { interest: 1_966.93, principal: 358.33, annualInterestRate: 6.25, remainingBalance: 377_291.67 }),
        ...Array.from({ length: 359 }, (_, i) => aPayment(i + 2, { annualInterestRate: 6.25, remainingBalance: i === 358 ? 0 : 300_000 })),
      ],
    }),
  });

  const render = (result: AmortizationResponse) => {
    const fixture = TestBed.createComponent(ProvenanceChipsComponent);
    fixture.componentRef.setInput('result', result);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, text: (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim() };
  };
  afterEach(() => document.body.replaceChildren());

  it('says the schedule is exact to the cent and ends at zero, when it does', () => {
    const { text } = render(example());

    expect(text('exact-chip')).toBe('Exact to the cent · ends at $0.00');
  });

  it('shows the arithmetic behind the payment, with the loan\'s own numbers, in a dialog', () => {
    const { root, text } = render(example());

    (root.querySelector('[data-testid="show-math"]') as HTMLButtonElement).click();

    const math = text('math')!;
    expect(root.querySelector('dialog')!.open).toBe(true);
    expect(root.querySelector('dialog h2')!.textContent).toBe('How $2,325.26 a month is worked out');
    expect(math).toContain('balance$377,650');
    expect(math).toContain('r6.25% ÷ 12 = 0.5208% a month');
    expect(math).toContain('n360 payments');
    expect(math).toContain('the interest is the balance times r, $1,966.93');
    expect(math).toContain('$358.33, pays the loan down');
  });

  it('offers no formula for a loan whose rate changes, which one formula would misstate', () => {
    const { root } = render(aResponse({ baseline: aSchedule({ rateChanges: [{ paymentNumber: 61, effectiveDate: '2031-01-01', previousRate: 6, newRate: 7, previousPayment: 1, newPayment: 2 }] }) }));

    expect(root.querySelector('[data-testid="show-math"]')).toBeNull();
  });
});
