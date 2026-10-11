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
      expect(sections.map((s) => s.dataset['testid'])).toEqual(['section-rate', 'section-taxes', 'section-costs', 'section-growth', 'section-options']);
      expect(el('pid-annual')?.closest('details')?.dataset['testid']).toBe('section-taxes');
      expect(sections.every((s) => !s.open)).toBe(true);
    });

    it('has no Calculate button: results update as you type', () => {
      expect(el('calculate')).toBeNull();
    });

    it('summarizes each closed section in one line', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
      expect(text('taxes-summary')).toBe('School 1% · County/city 1.1% · MUD 0.85% · Homestead');
      expect(text('costs-summary')).toBe('Insurance $2,400/yr · HOA $50/mo · PMI 0.5%');
      expect(text('growth-summary')).toBe('Home +4.3% · Insurance +4.8% · HOA +4%');
      expect(component.optionsSummary()).toBe('Pay off sooner');
    });

    it('updates the summaries as values change', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
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
      expect(text('options-summary')).toBe('$2,000 yearly · 1 lump sum · Recast (min $10,000)');
    });

    it('says when a section has nothing in it', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
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
      expect(component.optionsSummary()).toBe('2 lump sums · Pay off sooner');
    });

    it('flags a closed section that contains an invalid value, so the problem is not hidden', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
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
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
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
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
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

  describe('a loan already being paid (a first payment in the past)', () => {
    beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 9, 10), doNotFake: ['nextTick', 'setImmediate'] }));
    afterEach(() => jest.useRealTimers());

    /** The form opened on a $200,000 loan at 6% over 30 years, bought for $250,000, first paid on `firstPayment`. */
    const openOn = (firstPayment: string, loan: { balance: number; annualInterestRate: number; remainingTermInMonths: number; homeValue: number | null } | null = null) => {
      fixture = TestBed.createComponent(LoanFormComponent);
      component = fixture.componentInstance;
      emitted = [];
      component.calculate.subscribe((request) => emitted.push(request));
      fixture.componentRef.setInput('initial', {
        homePrice: 250_000, downPayment: 50_000, annualInterestRate: 6, termInMonths: 360, firstPaymentDate: firstPayment,
        strategy: 'ShortenTerm', recast: null, housingCosts: null,
        extraPayments: { monthlyAmount: 200, monthlyStartingPaymentNumber: 1, annual: { amount: 2_000, firstPaymentNumber: 12 }, lumpSums: [] },
      } satisfies AmortizationRequest);
      if (loan) fixture.componentRef.setInput('loan', { loan, from: 'Refinance', version: 1 });
      fixture.detectChanges();
      return emitted[emitted.length - 1];
    };

    it('starts at the real first payment, and starts extra payments with the next one', () => {
      const request = openOn('2021-11-01');

      expect(request.firstPaymentDate).toBe('2021-11-01'); // so PMI follows the original loan and its original schedule
      expect(request.extraPayments?.monthlyStartingPaymentNumber).toBe(61);
      expect(request.extraPayments?.annual?.firstPaymentNumber).toBe(72); // its next yearly date still ahead
      expect(text('existing-loan')).toBe(
        'A loan you already have: payment 61 of 360 is next, with about $186,109 owed. Extra payments start there; PMI follows the original loan.');
    });

    it('starts extra payments with the first payment for a new loan', () => {
      const request = openOn('2026-11-01');

      expect(request.extraPayments?.monthlyStartingPaymentNumber).toBe(1);
      expect(request.extraPayments?.annual?.firstPaymentNumber).toBe(12);
      expect(text('existing-loan')).toBeUndefined();
    });

    it('will not send a lump sum on a payment already made, or a loan whose whole term is behind it', () => {
      openOn('2021-11-01');
      const reports: string[][] = [];
      component.problems.subscribe((p) => reports.push(p));
      const sent = emitted.length;

      component.addLumpSum(); // payment 12, years ago
      controls().firstPaymentDate.setValue('1990-01-01');

      expect(reports).toEqual([
        [],
        ['A lump sum with payment #12 is in the past: payment #61 is next.'],
        ['With that first payment, the whole term is already behind you: pick a later date or a longer term.'],
      ]);
      expect(emitted).toHaveLength(sent);
    });

    it('takes a loan from another page by working out what was first borrowed, keeping its start and purchase price', () => {
      const request = openOn('2021-11-01', { balance: 186_108.71, annualInterestRate: 6, remainingTermInMonths: 300, homeValue: 400_000 });

      expect(request).toEqual(expect.objectContaining({ homePrice: 250_000, downPayment: 50_000, termInMonths: 360, firstPaymentDate: '2021-11-01' }));
      expect(text('existing-loan')).toContain('with about $186,109 owed');
    });

    it('takes a loan whose start another page knows exactly as it started, keeping its own purchase price', () => {
      fixture = TestBed.createComponent(LoanFormComponent);
      component = fixture.componentInstance;
      emitted = [];
      component.calculate.subscribe((request) => emitted.push(request));
      fixture.componentRef.setInput('loan', {
        loan: { balance: 186_108.71, annualInterestRate: 6, remainingTermInMonths: 300, homeValue: null,
          start: { amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' } },
        from: 'Refinance', version: 1,
      });
      fixture.detectChanges();

      expect(emitted[0]).toEqual(expect.objectContaining({
        homePrice: 375_000, downPayment: 175_000, annualInterestRate: 6, termInMonths: 360, firstPaymentDate: '2021-11-01',
      }));
      expect(text('existing-loan')).toContain('payment 61 of 360 is next');
    });

    it('rounds a part-year term, saying how many payments that leaves', () => {
      const request = openOn('2021-11-01', { balance: 180_000, annualInterestRate: 6, remainingTermInMonths: 295, homeValue: null });

      expect(request.termInMonths).toBe(360); // 60 made + 295 left, to the nearest whole year
      expect(text('loan-shared')).toContain('with 24 yr 7 mo left rounded to 25 yr');
      expect(text('existing-loan')).toContain('with about $180,000 owed'); // the balance itself is kept
    });
  });

  describe('one property tax rate (the default)', () => {
    it('sends one combined rate and its homestead exemption, and none of the separate taxes', () => {
      expect(last().housingCosts).toEqual(expect.objectContaining({
        propertyTaxRate: 2.2, propertyTaxHomesteadExemption: 50_000, schoolTaxRate: 0, localTaxRate: 0, mudTaxRate: 0, over65OrDisabled: null,
      }));
      expect(text('taxes-summary')).toBe('Tax 2.2% · Homestead $50,000 off');
    });

    it('sends the separate taxes instead once they are chosen, and checks only the fields in use', () => {
      controls().propertyTaxRate.setValue(40); // out of range, but not in use once the taxes are separate
      expect(component.form.valid).toBe(false);

      controls().taxMode.setValue('separate');

      expect(component.form.valid).toBe(true);
      expect(last().housingCosts).toEqual(expect.objectContaining({ propertyTaxRate: 0, schoolTaxRate: 1, localTaxRate: 1.1, mudTaxRate: 0.85 }));
    });

    it('says what the exemption saves in year 1', () => {
      fixture.componentRef.setInput('firstYear', {
        year: 1, startDate: '2026-11-01', marketValue: 375_000, assessedValue: 375_000,
        schoolTaxableValue: null, localTaxableValue: null, mudTaxableValue: null, propertyTaxableValue: 325_000,
        costs: { propertyTax: 0, schoolTax: 0, localTax: 0, mudTax: 0, pidAssessment: 0, homeownersInsurance: 0, mortgageInsurance: 0, hoaDues: 0, total: 0 },
      });
      fixture.detectChanges();

      expect(text('homestead-savings')).toBe('In year 1 the exemption saves $1,100 in tax.'); // 2.2% of the $50,000 exempt
    });

    it('reopens a calculation saved with separate taxes as separate taxes', () => {
      controls().taxMode.setValue('separate');
      const saved = last();

      const restored = TestBed.createComponent(LoanFormComponent);
      const sent: AmortizationRequest[] = [];
      restored.componentInstance.calculate.subscribe((r) => sent.push(r));
      restored.componentRef.setInput('initial', saved);
      restored.detectChanges();

      expect(restored.componentInstance.form.controls.taxMode.value).toBe('separate');
      expect(sent[sent.length - 1]).toEqual(saved);
    });
  });

  describe('homestead exemptions', () => {
    const firstYear = {
      year: 1, startDate: '2026-11-01', marketValue: 375_000, assessedValue: 375_000,
      schoolTaxableValue: 235_000, localTaxableValue: 300_000, mudTaxableValue: 375_000,
      costs: { schoolTax: 0, localTax: 0, mudTax: 0, pidAssessment: 0, homeownersInsurance: 0, mortgageInsurance: 0, hoaDues: 0, total: 0 },
    };

    it('says what each exemption saves in year 1, tax by tax', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
      fixture.componentRef.setInput('firstYear', firstYear);
      fixture.detectChanges();

      // School 1% on $140,000 exempt; county/city 1.1% on $75,000 (20%); MUD nothing exempt.
      expect(text('homestead-savings')).toBe('In year 1 these save $2,225 in tax: school $1,400 · county/city $825 · MUD $0.');
    });

    it('says nothing when the home is not a homestead', () => {
      fixture.componentRef.setInput('firstYear', firstYear);
      controls().isHomestead.setValue(false);
      fixture.detectChanges();

      expect(text('homestead-savings')).toBeUndefined();
    });

    it('sends the MUD exemption', () => {
      controls().mudHomesteadExemptionPercent.setValue(20);

      expect(last().housingCosts?.mudHomesteadExemptionPercent).toBe(20);
    });
  });

  describe('the rate type', () => {
    it('is fixed by default, and sends neither a buydown nor an adjustable rate', () => {
      expect(text('rate-summary')).toBe('Fixed for the whole loan');
      expect(last().buydown).toBeNull();
      expect(last().adjustableRate).toBeNull();
    });

    it('sends a buydown, and says what each year is paid at', () => {
      controls().rate.controls.rateType.setValue('buydown');
      controls().annualInterestRate.setValue(5.99);
      fixture.detectChanges();

      expect(last().buydown).toEqual({ yearlyReductions: [2, 1] });
      expect(last().adjustableRate).toBeNull();
      expect(text('rate-summary')).toBe('2-1 buydown: 3.99% in year 1, 4.99% in year 2, then 5.99%');

      controls().rate.controls.buydownPlan.setValue('3-2-1');
      fixture.detectChanges();
      expect(last().buydown).toEqual({ yearlyReductions: [3, 2, 1] });
    });

    it('sends an adjustable rate from its type, expected rate and caps, and checks them only while it is chosen', () => {
      controls().rate.controls.armExpectedRate.enable();
      controls().rate.controls.armExpectedRate.setValue(40);
      expect(component.form.valid).toBe(false);
      controls().rate.controls.rateType.setValue('fixed'); // switching away disables them again
      expect(component.form.valid).toBe(true);

      controls().rate.controls.rateType.setValue('arm');
      controls().rate.controls.armExpectedRate.setValue(7.5);
      controls().rate.controls.armType.setValue('5/6');
      fixture.detectChanges();

      expect(last().adjustableRate).toEqual({
        initialFixedMonths: 60, adjustmentIntervalMonths: 6, expectedRate: 7.5, initialCap: 5, periodicCap: 2, lifetimeCap: 5,
      });
      expect(text('rate-summary')).toBe('5/6 ARM: 6.5% for 5 yr, then toward 7.5% (caps 5/2/5)');
    });

    it('reopens a saved buydown or adjustable rate as it was', () => {
      controls().rate.controls.rateType.setValue('arm');
      controls().rate.controls.armType.setValue('10/1');
      controls().rate.controls.armLifetimeCap.setValue(6);
      const saved = last();

      const restored = TestBed.createComponent(LoanFormComponent);
      const sent: AmortizationRequest[] = [];
      restored.componentInstance.calculate.subscribe((r) => sent.push(r));
      restored.componentRef.setInput('initial', saved);
      restored.detectChanges();

      expect(sent[sent.length - 1]).toEqual(saved);
      expect(restored.componentInstance.form.controls.rate.controls.rateType.value).toBe('arm');
    });
  });

  describe('the shared loan', () => {
    const startFrom = (loan: { balance: number; annualInterestRate: number; remainingTermInMonths: number; homeValue: number | null }) => {
      fixture = TestBed.createComponent(LoanFormComponent);
      component = fixture.componentInstance;
      emitted = [];
      component.calculate.subscribe((request) => emitted.push(request));
      fixture.componentRef.setInput('loan', { loan, from: 'Pay off or invest', version: 1 });
      fixture.detectChanges();
      return emitted[0];
    };

    it("starts from the loan: the price is the home's value, the down payment what is not owed, the term the years left", () => {
      const request = startFrom({ balance: 300_000, annualInterestRate: 7, remainingTermInMonths: 300, homeValue: 400_000 });

      expect(request).toEqual(expect.objectContaining({ homePrice: 400_000, downPayment: 100_000, annualInterestRate: 7, termInMonths: 300 }));
      expect(text('loan-shared')).toContain('Filled in from your loan on the Pay off or invest page.');
      expect(request.extraPayments?.monthlyAmount).toBe(200); // its own inputs stay
    });

    it('rounds part years to a whole-year term, and says so', () => {
      const request = startFrom({ balance: 300_000, annualInterestRate: 7, remainingTermInMonths: 270, homeValue: 400_000 });

      expect(request.termInMonths).toBe(276);
      expect(text('loan-shared')).toContain('with 22 yr 6 mo left rounded to 23 yr');
    });

    it('keeps its own price when the loan has no home value, and never goes below a $0 down payment', () => {
      expect(startFrom({ balance: 300_000, annualInterestRate: 7, remainingTermInMonths: 300, homeValue: null }))
        .toEqual(expect.objectContaining({ homePrice: 375_000, downPayment: 75_000 }));
      expect(startFrom({ balance: 420_000, annualInterestRate: 7, remainingTermInMonths: 300, homeValue: 400_000 }))
        .toEqual(expect.objectContaining({ homePrice: 420_000, downPayment: 0 }));
    });
  });

  describe('validation', () => {
    it('reveals every error when an invalid form is submitted', () => {
      controls().annualInterestRate.setValue(45);

      component.submit();
      fixture.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(component.showError(controls().annualInterestRate)).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('Interest rate must be between 0% and 30%.');
    });

    it('reports everything wrong as it changes: bad numbers, bad lump sums, and nothing to borrow', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      const reports: string[][] = [];
      component.problems.subscribe((p) => reports.push(p));

      controls().schoolTaxRate.setValue(12);
      component.addLumpSum();
      component.lumpSums.at(0).controls.amount.setValue(0);
      controls().schoolTaxRate.setValue(1);
      component.lumpSums.at(0).controls.amount.setValue(5_000);
      controls().downPayment.setValue(375_000);

      expect(reports).toEqual([
        [],
        ['School tax rate must be between 0% and 10%.'],
        ['School tax rate must be between 0% and 10%.', 'Lump sum must be more than $0.'],
        ['Lump sum must be more than $0.'],
        [],
        ['The down payment must be less than the home price.'],
      ]);
    });

    it('explains when the down payment leaves nothing to borrow', () => {
      controls().downPayment.setValue(375_000);
      fixture.detectChanges();

      expect(emitted).toHaveLength(1);
      expect(fixture.nativeElement.textContent).toContain('The down payment must be less than the home price.');
    });

    it('rejects a recast minimum under $1,000, the least the API accepts', () => {
      controls().strategy.setValue('Recast');
      const before = emitted.length;

      controls().recastMinimum.setValue(500);
      controls().recastMinimum.markAsDirty(); // as typing would
      fixture.detectChanges();

      expect(emitted).toHaveLength(before);
      expect(fixture.nativeElement.textContent).toContain('Recast minimum must be between $1,000 and $100,000,000.');
    });

    it('does not flag an untouched valid field', () => {
      expect(component.showError(controls().homePrice)).toBe(false);
    });
  });

  describe('template', () => {
    it('shows homestead options only for a homestead, and over-65 options only when checked', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
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
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
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
