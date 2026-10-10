import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RefinanceRequest } from '../../../core/models/refinance.models';
import { RefinanceFormComponent } from './refinance-form.component';

describe('RefinanceFormComponent', () => {
  let fixture: ComponentFixture<RefinanceFormComponent>;
  let component: RefinanceFormComponent;
  let emitted: RefinanceRequest[];

  const create = (initial: RefinanceRequest | null = null) => {
    fixture = TestBed.createComponent(RefinanceFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.analyze.subscribe((r) => emitted.push(r));
    if (initial) fixture.componentRef.setInput('initial', initial);
    fixture.detectChanges();
  };
  const last = () => emitted[emitted.length - 1];
  const controls = () => component.form.controls;
  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;

  it('starts with a worked example that shows the clock restarting, and compares it at once', () => {
    create();

    expect(emitted).toEqual([{
      currentBalance: 300_000,
      currentAnnualInterestRate: 7,
      remainingTermInMonths: 300,
      nextPaymentDate: null,
      newAnnualInterestRate: 6,
      newTermInMonths: 360,
      closingCosts: 6_000,
      financeClosingCosts: false,
    }]);
  });

  it('turns years left into payments left, allowing part years', () => {
    create();

    controls().yearsLeft.setValue(22.5);

    expect(last().remainingTermInMonths).toBe(270);
  });

  it('can keep today\'s payoff date: the new term follows the years left', () => {
    create();

    controls().newTerm.setValue('keep');
    controls().yearsLeft.setValue(18);

    expect(last().newTermInMonths).toBe(216);
  });

  it('offers the usual terms, plus keeping the payoff date', () => {
    create();
    const options = [...fixture.nativeElement.querySelectorAll('[data-testid="new-term"] option')].map((o) => (o as HTMLOptionElement).textContent!.trim());

    expect(options).toEqual(['30 years', '25 years', '20 years', '15 years', '10 years', 'Keep my payoff date (25 years)']);
  });

  it('can add the closing costs to the loan', () => {
    create();

    controls().financeClosingCosts.setValue(true);

    expect(last().financeClosingCosts).toBe(true);
  });

  it('sends nothing while a value is invalid, and says what is wrong', () => {
    create();
    const before = emitted.length;

    controls().currentBalance.setValue(0);
    controls().currentBalance.markAsTouched();
    fixture.detectChanges();

    expect(emitted).toHaveLength(before);
    expect(el('refinance-form')!.textContent).toContain('Balance you still owe must be more than $0.');
  });

  it('starts from a loan changed on another page, keeping its own offer, and says so', () => {
    fixture = TestBed.createComponent(RefinanceFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.analyze.subscribe((r) => emitted.push(r));
    fixture.componentRef.setInput('loan', {
      loan: { balance: 250_000, annualInterestRate: 7.25, remainingTermInMonths: 270, homeValue: 400_000 }, from: 'Pay off or invest', version: 3,
    });
    fixture.detectChanges();

    expect(emitted[0]).toEqual(expect.objectContaining({
      currentBalance: 250_000, currentAnnualInterestRate: 7.25, remainingTermInMonths: 270, newAnnualInterestRate: 6, closingCosts: 6_000,
    }));
    expect(el('loan-shared')!.textContent).toContain('Filled in from your loan on the Pay off or invest page.');
  });

  it('restores a previous comparison instead of the example', () => {
    const previous: RefinanceRequest = {
      currentBalance: 250_000, currentAnnualInterestRate: 7.5, remainingTermInMonths: 240, nextPaymentDate: null,
      newAnnualInterestRate: 5.75, newTermInMonths: 240, closingCosts: 4_500, financeClosingCosts: true,
    };

    create(previous);

    expect(emitted).toEqual([previous]);
    expect(controls().newTerm.value).toBe('keep');
  });
});
