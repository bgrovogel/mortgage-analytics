import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FHA_LIMITS as LIMITS } from '../../../../testing/builders';
import { FormNavigator } from '../../../core/forms/form-navigator';
import { FhaLimitsService } from '../../../core/services/fha-limits.service';
import { LoanFormComponent, NOTHING_TO_BORROW } from './loan-form.component';
import { POINTS_RATE_TOO_LOW } from './loan-form.model';

@Component({ template: '' })
class BlankComponent {}

/**
 * What the loan form decides from its numbers: the problems it will not send, the way it converts the down payment,
 * how it says the loan type, and what it does when a result asks it to open a field. Each through the form itself.
 */
describe('LoanFormComponent logic', () => {
  let fixture: ComponentFixture<LoanFormComponent>;
  let component: LoanFormComponent;
  let reports: string[][];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: BlankComponent }]), { provide: FhaLimitsService, useValue: { limits: () => of(LIMITS) } }],
    });
    fixture = TestBed.createComponent(LoanFormComponent);
    component = fixture.componentInstance;
    reports = [];
    component.problems.subscribe((p) => reports.push(p));
    fixture.detectChanges();
  });

  const controls = () => component.form.controls;
  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const text = (id: string) => el(id)?.textContent?.replace(/\s+/g, ' ').trim();
  const lastProblems = () => reports[reports.length - 1];

  describe('what it will not send', () => {
    it('a tax rate change that starts after the loan has ended', () => {
      controls().termYears.setValue(10);
      component.addRateChange();
      controls().rateChanges.at(0).controls.fromYear.setValue(15);
      controls().rateChanges.at(0).controls.propertyTaxRate.setValue(1);

      expect(lastProblems()).toContain('A tax rate change must start within the loan\'s 10 years.');
    });

    it('a change that starts in the last year is fine', () => {
      controls().termYears.setValue(10);
      component.addRateChange();
      controls().rateChanges.at(0).controls.fromYear.setValue(10);
      controls().rateChanges.at(0).controls.propertyTaxRate.setValue(1);

      expect(lastProblems()).not.toContain('A tax rate change must start within the loan\'s 10 years.');
    });

    it('a down payment that is the whole price, or more: nothing is left to borrow', () => {
      controls().homePrice.setValue(300_000);
      controls().downPayment.setValue(300_000);

      expect(lastProblems()).toContain(NOTHING_TO_BORROW);

      controls().downPayment.setValue(299_999);
      expect(lastProblems()).not.toContain(NOTHING_TO_BORROW);
    });

    it('discount points at a rate that is not above the rate with them', () => {
      controls().annualInterestRate.setValue(6);
      controls().usePoints.setValue(true);
      controls().rateWithoutPoints.setValue(6);
      controls().rateWithoutPoints.markAsDirty();

      expect(lastProblems()).toContain(POINTS_RATE_TOO_LOW);

      controls().rateWithoutPoints.setValue(6.25);
      expect(lastProblems()).not.toContain(POINTS_RATE_TOO_LOW);
    });
  });

  describe('entering the down payment as a percentage', () => {
    it('converts what is typed both ways, to the cent, when the way of entering changes', () => {
      controls().homePrice.setValue(400_000);
      controls().downPayment.setValue(30_000);

      controls().downPaymentMode.setValue('percent');
      expect(controls().downPayment.value).toBe(7.5);

      controls().downPaymentMode.setValue('amount');
      expect(controls().downPayment.value).toBe(30_000);
    });

    it('is 0% for a home with no price yet, rather than a division by nothing', () => {
      controls().homePrice.setValue(0);
      controls().downPayment.setValue(5_000);

      controls().downPaymentMode.setValue('percent');

      expect(controls().downPayment.value).toBe(0);
    });
  });

  describe('the loan type, in a line', () => {
    it('says an FHA loan\'s upfront premium is added to the loan, or paid at closing', () => {
      controls().loanProgram.setValue('Fha');
      fixture.detectChanges();
      expect(text('program-summary')).toBe('FHA · upfront MIP added to the loan');

      controls().financeUpfrontFee.setValue(false);
      fixture.detectChanges();
      expect(text('program-summary')).toBe('FHA · upfront MIP paid at closing');
    });

    it('says a VA loan\'s use, and its funding fee, or that it has none', () => {
      controls().loanProgram.setValue('Va');
      controls().vaUse.setValue('FirstUse');
      fixture.detectChanges();
      expect(text('program-summary')).toBe('VA · first use · funding fee added to the loan');

      controls().vaUse.setValue('SubsequentUse');
      controls().financeUpfrontFee.setValue(false);
      fixture.detectChanges();
      expect(text('program-summary')).toBe('VA · used before · funding fee paid at closing');

      controls().vaUse.setValue('Exempt');
      fixture.detectChanges();
      expect(text('program-summary')).toBe('VA · exempt from the funding fee');
    });
  });

  describe('when a result asks for a field', () => {
    it('opens the section that has it, and puts the cursor there', () => {
      const section = el('section-income') as HTMLDetailsElement;
      const field = el('annual-income') as HTMLInputElement;
      field.scrollIntoView = jest.fn(); // jsdom has none
      expect(section.open).toBe(false);

      TestBed.inject(FormNavigator).open('income', 'annual-income');
      fixture.detectChanges();

      expect(section.open).toBe(true);
      expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
      expect(document.activeElement).toBe(field);
    });

    it('does nothing for a field that is not on the form', () => {
      expect(() => {
        TestBed.inject(FormNavigator).open('nowhere', 'nothing');
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('does not answer a request made before this form was, or when it is a compared home\'s form', () => {
      fixture.componentRef.setInput('shared', false);
      fixture.detectChanges();
      const section = el('section-income') as HTMLDetailsElement;

      TestBed.inject(FormNavigator).open('income', 'annual-income');
      fixture.detectChanges();

      expect(section.open).toBe(false);
    });
  });

  describe('undo', () => {
    it('does nothing when there is nothing to take back', () => {
      const before = controls().homePrice.value;

      component.undo();

      expect(controls().homePrice.value).toBe(before);
    });
  });
});
