import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { RateOptionsComponent } from './rate-options.component';
import { rateOptionsForm } from './rate-options';

describe('RateOptionsComponent', () => {
  function render(rate: number | null) {
    const fixture = TestBed.createComponent(RateOptionsComponent);
    const form = rateOptionsForm(TestBed.inject(NonNullableFormBuilder));
    form.patchValue({ rateType: 'buydown', buydownPlan: '2-1' });
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('rate', rate);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="buydown-hint"]')!.textContent!;
  }

  it("shows a buydown's yearly rates from the loan's rate", () => {
    expect(render(6.5)).toContain('4.5% in year 1, 5.5% in year 2, then 6.5%');
  });

  it('reads an emptied rate box (null) as 0% rather than showing nonsense', () => {
    expect(render(null)).toContain('0% in year 1, 0% in year 2, then 0%');
  });
});
