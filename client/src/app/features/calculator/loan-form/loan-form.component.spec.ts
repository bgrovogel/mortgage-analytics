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
  const last = () => emitted[emitted.length - 1];
  const submit = () => {
    component.submit();
    return last();
  };
  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const text = (testId: string) => el(testId)?.textContent?.replace(/\s+/g, ' ').trim();

  describe('on load', () => {
    it('submits the default example once, so results appear without any input', () => {
      expect(emitted).toHaveLength(1);
    });

    it('maps years to months and sends a complete Texas homestead example', () => {
      expect(emitted[0]).toMatchObject({
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

  describe('layout', () => {
    it('shows only the five main fields; everything else is in sections that start closed', () => {
      const sections = [...fixture.nativeElement.querySelectorAll('details')] as HTMLDetailsElement[];

      for (const id of ['home-price', 'down-payment', 'interest-rate', 'term-years', 'monthly-extra']) {
        expect(el(id)?.closest('details')).toBeNull();
      }
      expect(sections.map((s) => s.dataset['testid'])).toEqual(['section-taxes', 'section-costs', 'section-growth', 'section-options']);
      expect(el('pid-annual')?.closest('details')?.dataset['testid']).toBe('section-taxes');
      expect(sections.every((s) => !s.open)).toBe(true);
    });

    it('has no Calculate button: results update as you type', () => {
      expect(el('calculate')).toBeNull();
    });

    it('summarizes each closed section in one line', () => {
      expect(text('taxes-summary')).toBe('School 1% · County/city 1.1% · MUD 0.85% · Homestead');
      expect(text('costs-summary')).toBe('Insurance $2,400/yr · HOA $50/mo · PMI 0.5%');
      expect(text('growth-summary')).toBe('Home +4.3% · Insurance +4.8% · HOA +4%');
      expect(component.optionsSummary()).toMatch(/^First payment [A-Z][a-z]{2} \d{4} · Pay off sooner$/);
    });

    it('updates the summaries as values change', () => {
      controls().isOver65.setValue(true);
      controls().mudTaxRate.setValue(0);
      controls().pidAnnual.setValue(1_200);
      controls().downPayment.setValue(75_000);
      controls().homeValueGrowthRate.setValue(-2);
      controls().annualExtra.setValue(2_000);
      controls().strategy.setValue('Recast');
      component.addLumpSum();
      controls().firstPaymentDate.setValue('2027-03-01');
      fixture.detectChanges();

      expect(text('taxes-summary')).toBe('School 1% · County/city 1.1% · PID $1,200/yr · Homestead · Over 65');
      expect(text('costs-summary')).toBe('Insurance $2,400/yr · HOA $50/mo');
      expect(text('growth-summary')).toBe('Home -2% · Insurance +4.8% · HOA +4%');
      expect(text('options-summary')).toBe('First payment Mar 2027 · $2,000 yearly · 1 lump sum · Recast (min $10,000)');
    });

    it('says when a section has nothing in it', () => {
      for (const name of ['schoolTaxRate', 'localTaxRate', 'mudTaxRate', 'annualInsurance', 'monthlyHoa', 'pmiRate'] as const) {
        controls()[name].setValue(0);
      }
      controls().isHomestead.setValue(false);
      controls().firstPaymentDate.setValue('');
      component.addLumpSum();
      component.addLumpSum();
      fixture.detectChanges();

      expect(text('taxes-summary')).toBe('No property taxes');
      expect(text('costs-summary')).toBe('None');
      expect(component.optionsSummary()).toBe('First payment next month · 2 lump sums · Pay off sooner');
    });

    it('flags a closed section that contains an invalid value, so the problem is not hidden', () => {
      controls().mudTaxRate.setValue(9);
      controls().pmiRate.setValue(-1);
      controls().hoaIncreaseRate.setValue(99);
      controls().strategy.setValue('Recast');
      controls().recastMinimum.setValue(10);
      fixture.detectChanges();

      for (const id of ['taxes-summary', 'costs-summary', 'growth-summary', 'options-summary']) {
        expect(text(id)).toBe('Check the values in this section');
      }
    });
  });

  describe('down payment in dollars or percent', () => {
    it('starts in dollars', () => {
      expect(controls().downPaymentMode.value).toBe('amount');
      expect(last().downPayment).toBe(18_750);
    });

    it('converts the value when switching to percent, and back', () => {
      controls().downPaymentMode.setValue('percent');
      expect(controls().downPayment.value).toBe(5);
      expect(last().downPayment).toBe(18_750);

      controls().downPaymentMode.setValue('amount');
      expect(controls().downPayment.value).toBe(18_750);
    });

    it('sends the dollar amount for a percentage, rounded to cents', () => {
      controls().downPaymentMode.setValue('percent');
      controls().downPayment.setValue(12.5);

      expect(last().downPayment).toBe(46_875);
      expect(component.loanAmount()).toBe(328_125);
      expect(component.downPaymentPercent()).toBeCloseTo(12.5);
    });

    it('shows the other unit under the field, so both are always visible', () => {
      controls().downPaymentMode.setValue('percent');
      fixture.detectChanges();

      expect(text('loan-summary')).toBe('$18,750 down (5%) · Loan $356,250');
    });

    it('rejects 100% or more, which leaves nothing to borrow', () => {
      controls().downPaymentMode.setValue('percent');
      const before = emitted.length;

      controls().downPayment.setValue(100);
      fixture.detectChanges();

      expect(emitted).toHaveLength(before);
      expect(fixture.nativeElement.textContent).toContain('The down payment must be less than the home price.');
    });
  });

  describe('recalculating as you type', () => {
    it('emits a new request whenever a change leaves the form valid', () => {
      controls().monthlyExtra.setValue(300);

      expect(emitted).toHaveLength(2);
      expect(last().extraPayments?.monthlyAmount).toBe(300);
    });

    it('emits nothing while the form is invalid', () => {
      controls().annualInterestRate.setValue(45);
      controls().downPayment.setValue(400_000);

      expect(emitted).toHaveLength(1);
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
      expect(last().recast).toEqual({ minimumLumpSum: 10_000, fee: 250 });
    });

    it('sends an annual extra only when its amount is positive', () => {
      controls().annualExtra.setValue(2_000);
      controls().annualFirstPayment.setValue(6);

      expect(last().extraPayments?.annual).toEqual({ amount: 2_000, firstPaymentNumber: 6 });
    });

    it('adds and removes lump sums', () => {
      component.addLumpSum();
      component.addLumpSum();
      component.removeLumpSum(0);

      expect(last().extraPayments?.lumpSums).toEqual([{ paymentNumber: 12, amount: 10_000 }]);
    });

    it('sends a PID only when its assessment is positive, with no end year when blank', () => {
      controls().pidAnnual.setValue(1_200);
      expect(last().housingCosts?.pid).toEqual({ annualAssessment: 1_200, remainingYears: null });

      controls().pidYears.setValue(20);
      expect(last().housingCosts?.pid).toEqual({ annualAssessment: 1_200, remainingYears: 20 });
    });

    it('sends over-65 relief only for a homestead', () => {
      controls().isOver65.setValue(true);
      controls().over65Year.setValue(6);

      expect(component.isOver65()).toBe(true);
      expect(last().housingCosts?.over65OrDisabled).toEqual({
        qualifiesInYear: 6,
        schoolExemption: 60_000,
        localExemption: 0,
        localTaxCeiling: false,
      });

      controls().isHomestead.setValue(false);
      expect(component.isOver65()).toBe(false);
      expect(last().housingCosts?.over65OrDisabled).toBeNull();
    });

    it('sends zeros for blank optional amounts and null for a blank first payment date', () => {
      const optional = [
        'monthlyExtra', 'schoolTaxRate', 'localTaxRate', 'mudTaxRate', 'schoolHomesteadExemption',
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
      expect(request.housingCosts).toMatchObject({ schoolTaxRate: 0, localTaxRate: 0, pmiRate: 0, monthlyHoaDues: 0 });
      expect(request.housingCosts?.over65OrDisabled).toEqual({ qualifiesInYear: 1, schoolExemption: 0, localExemption: 0, localTaxCeiling: false });
    });
  });

  describe('restoring a request (returning to the page, or opening a saved calculation)', () => {
    const restore = (request: AmortizationRequest) => {
      const restored = TestBed.createComponent(LoanFormComponent);
      const sent: AmortizationRequest[] = [];
      restored.componentInstance.calculate.subscribe((r) => sent.push(r));
      restored.componentRef.setInput('initial', request);
      restored.detectChanges();
      return { form: restored.componentInstance, sent };
    };

    it('fills every field from the request, so it sends the very same request back', () => {
      controls().homePrice.setValue(420_000);
      controls().downPayment.setValue(84_000);
      controls().termYears.setValue(15);
      controls().firstPaymentDate.setValue('2027-03-01');
      controls().pidAnnual.setValue(1_200);
      controls().pidYears.setValue(12);
      controls().isOver65.setValue(true);
      controls().over65Year.setValue(4);
      controls().over65LocalCeiling.setValue(true);
      controls().pmiCancellation.setValue('BorrowerRequested');
      controls().annualExtra.setValue(2_000);
      controls().annualFirstPayment.setValue(6);
      component.addLumpSum();
      controls().strategy.setValue('Recast');
      controls().recastFee.setValue(300);
      const original = last();

      const { sent } = restore(original);

      expect(sent).toEqual([original]);
    });

    it('restores the down payment in dollars, whichever unit it was entered in', () => {
      controls().downPaymentMode.setValue('percent');
      controls().downPayment.setValue(10);

      const { form } = restore(last());

      expect(form.form.controls.downPaymentMode.value).toBe('amount');
      expect(form.form.controls.downPayment.value).toBe(37_500);
    });

    it('treats missing extras and costs as zero', () => {
      const { form, sent } = restore({ ...last(), extraPayments: null, housingCosts: null, firstPaymentDate: null });

      expect(form.form.controls.monthlyExtra.value).toBe(0);
      expect(form.form.controls.schoolTaxRate.value).toBe(0);
      expect(form.form.controls.firstPaymentDate.value).toBe('');
      expect(sent[0].housingCosts!.pmiRate).toBe(0);
    });
  });

  describe('validation', () => {
    it('reveals every error when an invalid form is submitted', () => {
      controls().annualInterestRate.setValue(45);

      component.submit();
      fixture.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(component.showError(controls().annualInterestRate)).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Rate must be between 0% and 30%.');
    });

    it('explains when the down payment leaves nothing to borrow', () => {
      controls().downPayment.setValue(375_000);
      fixture.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(fixture.nativeElement.textContent).toContain('The down payment must be less than the home price.');
    });

    it('rejects a recast minimum under $1,000, and explains why', () => {
      controls().strategy.setValue('Recast');
      const before = emitted.length;

      controls().recastMinimum.setValue(500);
      controls().recastMinimum.markAsDirty(); // as typing would
      fixture.detectChanges();

      expect(emitted).toHaveLength(before);
      expect(fixture.nativeElement.textContent).toContain('Lenders require a lump sum of at least $1,000 to recast.');
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
      expect(el('pmi-hint')?.textContent).toContain('extra payments only count if you ask at 80%');

      controls().downPayment.setValue(75_000);
      fixture.detectChanges();

      expect(el('pmi-hint')?.textContent).toContain('No PMI');
    });

    it('formats numbers with thousands separators and shows the unit inside the box', () => {
      const price = el('home-price') as HTMLInputElement;

      expect(price.type).toBe('text');
      expect(price.value).toBe('375,000');
      expect((price.closest('.affix') as HTMLElement).dataset['prefix']).toBe('$');
      expect((el('interest-rate')!.closest('.affix') as HTMLElement).dataset['suffix']).toBe('%');
    });

    it('switches the down payment unit marker with the $ | % toggle', () => {
      controls().downPaymentMode.setValue('percent');
      fixture.detectChanges();

      const affix = el('down-payment')!.closest('.affix') as HTMLElement;
      expect(affix.dataset['suffix']).toBe('%');
      expect(affix.dataset['prefix']).toBeUndefined();
    });

    it('uses the number box for every numeric field, so none shows spinner arrows', () => {
      expect(fixture.nativeElement.querySelectorAll('input[type="number"]')).toHaveLength(0);
    });

    it('spells out jargon for screen readers and on hover', () => {
      const titles = [...fixture.nativeElement.querySelectorAll('abbr')].map((a: HTMLElement) => a.title);

      expect(titles).toEqual(expect.arrayContaining([
        'Municipal Utility District',
        'Public Improvement District',
        'Private mortgage insurance',
      ]));
    });
  });

  it('starts future increases at long-run US averages, and says where each comes from', () => {
    expect([controls().homeValueGrowthRate.value, controls().insuranceIncreaseRate.value, controls().hoaIncreaseRate.value]).toEqual([4.3, 4.8, 4]);
    const sources = text('growth-sources');
    expect(sources).toContain('FHFA');
    expect(sources).toContain('GAO');
  });
});
