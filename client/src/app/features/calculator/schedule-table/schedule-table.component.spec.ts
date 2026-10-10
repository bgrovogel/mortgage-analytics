import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aHousingCosts, aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { ScheduleTableComponent } from './schedule-table.component';

describe('ScheduleTableComponent', () => {
  let fixture: ComponentFixture<ScheduleTableComponent>;

  const render = (response: AmortizationResponse) => {
    fixture = TestBed.createComponent(ScheduleTableComponent);
    fixture.componentRef.setInput('result', response);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  const rows = () => fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>;
  const headers = () => [...fixture.nativeElement.querySelectorAll('thead th')].map((th: Element) => th.textContent?.trim());
  const click = (testId: string) => {
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`).click();
    fixture.detectChanges();
  };

  const response = aResponse({ baseline: aSchedule({}, 5), accelerated: aSchedule({}, 3) });

  it('shows the accelerated schedule by default', () => {
    render(response);

    expect(rows()).toHaveLength(3);
  });

  it('switches between the accelerated and standard schedules', () => {
    const component = render(response);

    click('view-baseline');
    expect(component.view()).toBe('baseline');
    expect(rows()).toHaveLength(5);

    click('view-accelerated');
    expect(rows()).toHaveLength(3);
  });

  it('hides the taxes and total columns when there are no housing costs', () => {
    const component = render(response);

    expect(component.hasHousingCosts()).toBe(false);
    expect(headers()).not.toContain('Total');
  });

  it('adds the taxes and total columns, and tags months that include PMI', () => {
    const accelerated = aSchedule({
      totalHousingCosts: aHousingCosts({ mortgageInsurance: 300 }),
      payments: [aPayment(1, { housingCosts: 100, mortgageInsurance: 100 }), aPayment(2, { housingCosts: 0 })],
    });
    render(aResponse({ accelerated }));

    expect(headers()).toEqual(expect.arrayContaining(['Taxes & fees', 'Total']));
    expect(rows()[0].textContent).toContain('PMI');
    expect(rows()[1].textContent).not.toContain('PMI');
  });

  it('shows extra principal, a dash when there is none, and tags the payment that triggered a recast', () => {
    const accelerated = aSchedule({
      payments: [aPayment(1), aPayment(2, { extraPrincipal: 25_000 })],
      recasts: [{ afterPaymentNumber: 2, effectiveDate: '2026-03-01', previousPayment: 1_000, newPayment: 800, fee: 250 }],
    });
    const component = render(aResponse({ accelerated }));

    expect(component.recastAfter().has(2)).toBe(true);
    expect(rows()[0].textContent).toContain('—');
    expect(rows()[1].textContent).toContain('$25,000.00');
    expect(rows()[1].querySelector('[data-testid="recast-tag"]')).not.toBeNull();
  });
});
