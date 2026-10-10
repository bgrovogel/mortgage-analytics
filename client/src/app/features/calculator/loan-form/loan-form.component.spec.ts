import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AmortizationRequest } from '../../../core/models/amortization.models';
import { LoanFormComponent } from './loan-form.component';

describe('LoanFormComponent', () => {
  let fixture: ComponentFixture<LoanFormComponent>;
  let component: LoanFormComponent;
  let emitted: AmortizationRequest[];

  beforeEach(() => {
    fixture = TestBed.createComponent(LoanFormComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.calculate.subscribe((request) => emitted.push(request));
    fixture.detectChanges(); // ngOnInit submits the defaults
  });

  const controls = () => component.form.controls;
  const submit = () => {
    component.submit();
    return emitted[emitted.length - 1];
  };
  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;

  describe('on load', () => {
    it('submits the default example once, so results appear without a click', () => {
      expect(emitted).toHaveLength(1);
    });

    it('maps years to months and sends a complete Texas homestead example', () => {
      const request = emitted[0];

      expect(request).toMatchObject({
        homePrice: 375_000,
        downPayment: 18_750,
        termInMonths: 360,
        strategy: 'ShortenTerm',
        recast: null,
        extraPayments: { monthlyAmount: 200, monthlyStartingPaymentNumber: 1, annual: null, lumpSums: [] },
        housingCosts: { isHomestead: true, schoolHomesteadExemption: 140_000, over65OrDisabled: null, pid: null },
      });
    });

    it('derives the loan amount, down-payment percentage and PMI flag', () => {
      expect(component.loanAmount()).toBe(356_250);
      expect(component.downPaymentPercent()).toBeCloseTo(5);
      expect(component.pmiApplies()).toBe(true);
    });
  });

  describe('derived values', () => {
    it('drops PMI at 20% down', () => {
      controls().downPayment.setValue(75_000);

      expect(component.pmiApplies()).toBe(false);
    });

    it('treats a zero price as 0% down rather than dividing by zero', () => {
      controls().homePrice.setValue(0);

      expect(component.downPaymentPercent()).toBe(0);
      expect(component.loanAmount()).toBe(0);
    });
  });

  describe('mapping the form to a request', () => {
    it('sends recast terms only for the recast strategy', () => {
      controls().strategy.setValue('Recast');

      expect(component.isRecast()).toBe(true);
      expect(submit().recast).toEqual({ minimumLumpSum: 10_000, fee: 250 });
    });

    it('sends an annual extra only when its amount is positive', () => {
      controls().annualExtra.setValue(2_000);
      controls().annualFirstPayment.setValue(6);

      expect(submit().extraPayments?.annual).toEqual({ amount: 2_000, firstPaymentNumber: 6 });
    });

    it('adds and removes lump sums', () => {
      component.addLumpSum();
      component.addLumpSum();
      component.removeLumpSum(0);

      expect(submit().extraPayments?.lumpSums).toEqual([{ paymentNumber: 12, amount: 10_000 }]);
    });

    it('sends a PID only when its assessment is positive, with no end year when blank', () => {
      controls().pidAnnual.setValue(1_200);

      expect(submit().housingCosts?.pid).toEqual({ annualAssessment: 1_200, remainingYears: null });

      controls().pidYears.setValue(20);
      expect(submit().housingCosts?.pid).toEqual({ annualAssessment: 1_200, remainingYears: 20 });
    });

    it('sends over-65 relief only for a homestead', () => {
      controls().isOver65.setValue(true);
      controls().over65Year.setValue(6);

      expect(component.isOver65()).toBe(true);
      expect(submit().housingCosts?.over65OrDisabled).toEqual({
        qualifiesInYear: 6,
        schoolExemption: 60_000,
        localExemption: 0,
        localTaxCeiling: false,
      });

      controls().isHomestead.setValue(false);
      expect(component.isOver65()).toBe(false);
      expect(submit().housingCosts?.over65OrDisabled).toBeNull();
    });

    it('sends zeros for blank optional amounts and null for a blank first payment date', () => {
      const optional = [
        'monthlyExtra', 'schoolTaxRate', 'propertyTaxRate', 'mudTaxRate', 'schoolHomesteadExemption',
        'localHomesteadExemptionPercent', 'homesteadAssessmentCap', 'homeValueGrowthRate', 'insuranceIncreaseRate',
        'hoaIncreaseRate', 'annualInsurance', 'monthlyHoa', 'pmiRate',
      ] as const;
      optional.forEach((name) => controls()[name].setValue(null as never));
      controls().isOver65.setValue(true);
      controls().over65Year.setValue(null as never);
      controls().over65SchoolExemption.setValue(null as never);
      controls().over65LocalExemption.setValue(null as never);
      controls().firstPaymentDate.setValue('');

      const request = submit();

      expect(request.firstPaymentDate).toBeNull();
      expect(request.extraPayments?.monthlyAmount).toBe(0);
      expect(request.housingCosts).toMatchObject({ schoolTaxRate: 0, propertyTaxRate: 0, pmiRate: 0, monthlyHoaDues: 0 });
      expect(request.housingCosts?.over65OrDisabled).toEqual({ qualifiesInYear: 1, schoolExemption: 0, localExemption: 0, localTaxCeiling: false });
    });
  });

  describe('validation', () => {
    it('does not submit an out-of-range rate, and reveals the error', () => {
      controls().annualInterestRate.setValue(45);

      component.submit();
      fixture.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(component.showError(controls().annualInterestRate)).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Rate must be between 0% and 30%.');
    });

    it('does not submit when the down payment leaves nothing to borrow', () => {
      controls().downPayment.setValue(375_000);

      component.submit();
      fixture.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(fixture.nativeElement.textContent).toContain('The down payment must be less than the home price.');
    });

    it('does not flag an untouched valid field', () => {
      expect(component.showError(controls().homePrice)).toBe(false);
    });
  });

  describe('template', () => {
    it('shows homestead options only for a homestead, and over-65 options only when checked', () => {
      expect(el('school-exemption')).not.toBeNull();
      expect(el('over-65-year')).toBeNull();

      controls().isOver65.setValue(true);
      fixture.detectChanges();
      expect(el('over-65-year')).not.toBeNull();

      controls().isHomestead.setValue(false);
      fixture.detectChanges();
      expect(el('school-exemption')).toBeNull();
    });

    it('shows recast terms only for the recast strategy', () => {
      expect(el('recast-minimum')).toBeNull();

      controls().strategy.setValue('Recast');
      fixture.detectChanges();

      expect(el('recast-minimum')).not.toBeNull();
    });

    it('explains why PMI does or does not apply', () => {
      expect(el('pmi-hint')?.textContent).toContain('PMI applies');

      controls().downPayment.setValue(75_000);
      fixture.detectChanges();

      expect(el('pmi-hint')?.textContent).toContain('No PMI');
    });

    it('disables the button and says so while busy', () => {
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();

      const button = el('calculate') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain('Calculating');
    });
  });
});
