import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aHousingCosts, aSchedule } from '../../../../testing/builders';
import { Schedule } from '../../../core/models/amortization.models';
import { PaymentBreakdownComponent } from './payment-breakdown.component';

describe('PaymentBreakdownComponent', () => {
  let fixture: ComponentFixture<PaymentBreakdownComponent>;

  const render = (schedule: Schedule) => {
    fixture = TestBed.createComponent(PaymentBreakdownComponent);
    fixture.componentRef.setInput('schedule', schedule);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  const withCosts = render.bind(null);
  const schedule = aSchedule({
    monthlyPayment: 750,
    monthlyHousingCosts: aHousingCosts({ schoolTax: 150, hoaDues: 100 }),
    totalMonthlyPayment: 1_000,
  });

  it('shows principal and interest first, then only the costs that are present', () => {
    const component = withCosts(schedule);

    expect(component.slices().map((s) => s.label)).toEqual(['Principal & interest', 'School tax', 'HOA dues']);
  });

  it('gives each slice its share of the total payment', () => {
    const component = withCosts(schedule);

    expect(component.slices().map((s) => s.share)).toEqual([0.75, 0.15, 0.1]);
  });

  it('keeps a fixed color per category, whatever else is present', () => {
    const component = withCosts(schedule);

    expect(component.slices().find((s) => s.label === 'HOA dues')?.color).toBe('--series-8');
  });

  it('shows every tax that is present, including county and city tax', () => {
    const component = withCosts(aSchedule({
      monthlyPayment: 1_000,
      monthlyHousingCosts: aHousingCosts({ schoolTax: 195.83, localTax: 343.75, mudTax: 265.63 }),
      totalMonthlyPayment: 1_805.21,
    }));

    expect(component.slices().map((s) => s.label)).toEqual(['Principal & interest', 'School tax', 'County & city tax', 'MUD tax']);
    expect(fixture.nativeElement.textContent).toContain('$343.75');
  });

  it('describes the bar in text for screen readers', () => {
    const component = withCosts(schedule);

    expect(component.ariaLabel()).toBe('Principal & interest 75%, School tax 15%, HOA dues 10%');
  });

  it('shows the total payment', () => {
    withCosts(schedule);

    expect(fixture.nativeElement.querySelector('[data-testid="breakdown-total"]').textContent.trim()).toBe('$1,000.00');
  });

  it('does not divide by zero when the total is zero', () => {
    const component = render(aSchedule({ monthlyPayment: 0, totalMonthlyPayment: 0 }));

    expect(component.slices()).toEqual([]);
  });
});
