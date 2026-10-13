import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AmortizationRequest } from '../../../core/models/amortization.models';
import { of } from 'rxjs';
import { FhaLimitsService } from '../../../core/services/fha-limits.service';
import { FHA_LIMITS as LIMITS } from '../../../../testing/builders';
import { LoanFormComponent } from './loan-form.component';

describe('LoanFormComponent', () => {
  let fixture: ComponentFixture<LoanFormComponent>;
  let component: LoanFormComponent;
  let emitted: AmortizationRequest[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: FhaLimitsService, useValue: { limits: () => of(LIMITS) } }] });
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

    it('marks the loan as shared in its heading, and says where it came from only when it was filled in', () => {
      expect(text('shared-tag')).toBe('Used on all three pages');
      expect(el('loan-shared')).toBeNull();
    });

    it('keeps how to enter a loan you already have one tap away, rather than always on', () => {
      const help = el('first-payment-help') as HTMLDetailsElement;

      expect(help.tagName).toBe('DETAILS');
      expect(help.open).toBe(false);
      expect(help.textContent).toContain('its real first payment');
    });

    it('puts every optional section under More details, apart from the five main numbers', () => {
      const details = el('more-details')!;

      expect(details.querySelector('h3')?.textContent).toBe('More details');
      expect([...details.querySelectorAll('details.section')].map((d) => d.getAttribute('data-testid')))
        .toEqual(['section-program', 'section-rate', 'section-taxes', 'section-costs', 'section-closing', 'section-growth', 'section-options']);
    });

    it('says the numbers are an example until the first edit, and never for a restored loan', () => {
      expect(text('example-note')).toContain('example numbers');

      controls().homePrice.setValue(400_000);
      fixture.detectChanges();
      expect(el('example-note')).toBeNull();

      const restored = TestBed.createComponent(LoanFormComponent);
      restored.componentRef.setInput('initial', emitted[0]);
      restored.detectChanges();
      expect(restored.nativeElement.querySelector('[data-testid="example-note"]')).toBeNull();
    });

    it('maps years to months and sends a complete example of an average purchase', () => {
      expect(emitted[0]).toMatchObject({
        homePrice: 415_000,
        downPayment: 37_350,
        termInMonths: 360,
        strategy: 'ShortenTerm',
        recast: null,
        extraPayments: { monthlyAmount: 200, monthlyStartingPaymentNumber: 1, annual: null, lumpSums: [] },
        housingCosts: { isHomestead: true, schoolHomesteadExemption: 140_000, over65OrDisabled: null, pid: null },
        closingCosts: { loanCosts: 4_000, otherFees: 1_000, prepaidInterestDays: 15, escrowMonths: 3, credits: 0 },
      });
    });

    it('derives the loan amount, down-payment percentage and PMI flag', () => {
      expect(component.loanAmount()).toBe(377_650);
      expect(component.downPaymentPercent()).toBeCloseTo(9);
      expect(component.pmiApplies()).toBe(true);
    });
  });

  describe('layout', () => {
    it('shows only the five main fields; everything else is in sections that start closed', () => {
      const sections = [...fixture.nativeElement.querySelectorAll('details.section')] as HTMLDetailsElement[];

      for (const id of ['home-price', 'down-payment', 'interest-rate', 'term-years', 'monthly-extra']) {
        expect(el(id)?.closest('details')).toBeNull();
      }
      expect(sections.map((s) => s.dataset['testid'])).toEqual(['section-program', 'section-rate', 'section-taxes', 'section-costs', 'section-closing', 'section-growth', 'section-options']);
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
      expect(text('costs-summary')).toBe('Insurance $3,100/yr · HOA $50/mo · PMI 0.5%');
      expect(text('closing-summary')).toBe('Fees $5,000 · 15 days interest · 3 mo escrow');
      expect(text('growth-summary')).toBe('Home +4.3% · Insurance +4.8% · HOA +4%');
      expect(component.optionsSummary()).toBe('Pay off sooner');
    });

    it('updates the summaries as values change', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
      controls().isOver65.setValue(true);
      controls().mudTaxRate.setValue(0);
      controls().pidAnnual.setValue(1_200);
      controls().downPayment.setValue(83_000);
      controls().homeValueGrowthRate.setValue(-2);
      controls().annualExtra.setValue(2_000);
      controls().strategy.setValue('Recast');
      component.addLumpSum();
      controls().firstPaymentDate.setValue('2027-03-01');
      controls().escrowMonths.setValue(2);
      controls().closingCredits.setValue(3_000);
      fixture.detectChanges();

      expect(text('taxes-summary')).toBe('School 1% · County/city 1.1% · PID $1,200/yr · Homestead · Over 65');
      expect(text('closing-summary')).toBe('Fees $5,000 · 15 days interest · 2 mo escrow · Credits $3,000');
      expect(text('costs-summary')).toBe('Insurance $3,100/yr · HOA $50/mo');
      expect(text('growth-summary')).toBe('Home -2% · Insurance +4.8% · HOA +4%');
      expect(text('options-summary')).toBe('$2,000 yearly · 1 lump sum · Recast (min $10,000)');
    });

    it('says when a section has nothing in it', () => {
      controls().taxMode.setValue('separate'); // the separate (Texas) taxes
      fixture.detectChanges();
      for (const name of ['schoolTaxRate', 'localTaxRate', 'mudTaxRate', 'annualInsurance', 'monthlyHoa', 'pmiRate',
        'loanCosts', 'otherFees', 'prepaidInterestDays', 'escrowMonths'] as const) {
        controls()[name].setValue(0);
      }
      controls().isHomestead.setValue(false);
      controls().firstPaymentDate.setValue('');
      component.addLumpSum();
      component.addLumpSum();
      fixture.detectChanges();

      expect(text('taxes-summary')).toBe('No property taxes');
      expect(text('costs-summary')).toBe('None');
      expect(text('closing-summary')).toBe('No fees');
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
      controls().escrowMonths.setValue(15);
      fixture.detectChanges();

      for (const id of ['taxes-summary', 'costs-summary', 'closing-summary', 'growth-summary', 'options-summary']) {
        expect(text(id)).toBe('Check the values in this section');
      }
    });
  });

  describe('down payment in dollars or percent', () => {
    it('starts in dollars', () => {
      expect(controls().downPaymentMode.value).toBe('amount');
      expect(last().downPayment).toBe(37_350);
    });

    it('converts the value when switching to percent, and back', () => {
      controls().downPaymentMode.setValue('percent');
      expect(controls().downPayment.value).toBe(9);
      expect(last().downPayment).toBe(37_350);

      controls().downPaymentMode.setValue('amount');
      expect(controls().downPayment.value).toBe(37_350);
    });

    it('sends the dollar amount for a percentage, rounded to cents', () => {
      controls().downPaymentMode.setValue('percent');
      controls().downPayment.setValue(12.5);

      expect(last().downPayment).toBe(51_875);
      expect(component.loanAmount()).toBe(363_125);
      expect(component.downPaymentPercent()).toBeCloseTo(12.5);
    });

    it('shows the other unit under the field, so both are always visible', () => {
      controls().downPaymentMode.setValue('percent');
      fixture.detectChanges();

      expect(text('loan-summary')).toBe('$37,350 down (9%) · Loan $377,650');
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
      controls().downPayment.setValue(83_000);

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
        transferredCeilingPercent: null,
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
        'hoaIncreaseRate', 'annualInsurance', 'monthlyHoa', 'pmiRate', 'loanCosts', 'otherFees', 'prepaidInterestDays',
        'escrowMonths', 'closingCredits',
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
      expect(request.housingCosts?.over65OrDisabled).toEqual({ qualifiesInYear: 1, schoolExemption: 0, localExemption: 0, localTaxCeiling: false, transferredCeilingPercent: null });
      expect(request.closingCosts).toEqual({ loanCosts: 0, otherFees: 0, prepaidInterestDays: 0, escrowMonths: 0, credits: 0 });
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
      controls().pmiCancellation.setValue('Automatic');
      controls().annualExtra.setValue(2_000);
      controls().annualFirstPayment.setValue(6);
      component.addLumpSum();
      controls().strategy.setValue('Recast');
      controls().recastFee.setValue(300);
      controls().rate.controls.rateType.setValue('buydown');
      controls().buydownPaidBy.setValue('Borrower');
      controls().loanCosts.setValue(6_250);
      controls().otherFees.setValue(1_480);
      controls().prepaidInterestDays.setValue(22);
      controls().escrowMonths.setValue(8);
      controls().closingCredits.setValue(2_000);
      controls().rate.controls.rateType.setValue('fixed');
      controls().usePoints.setValue(true);
      controls().points.setValue(1.375);
      const original = last();

      const { sent } = restore(original);

      expect(sent).toEqual([original]);
    });

    it('restores the down payment in dollars, whichever unit it was entered in', () => {
      controls().downPaymentMode.setValue('percent');
      controls().downPayment.setValue(10);

      const { form } = restore(last());

      expect(form.form.controls.downPaymentMode.value).toBe('amount');
      expect(form.form.controls.downPayment.value).toBe(41_500);
    });

    it('treats missing extras and costs as zero', () => {
      const { form, sent } = restore({ ...last(), extraPayments: null, housingCosts: null, firstPaymentDate: null });

      expect(form.form.controls.monthlyExtra.value).toBe(0);
      expect(form.form.controls.schoolTaxRate.value).toBe(0);
      expect(form.form.controls.firstPaymentDate.value).toBe('');
      expect(sent[0].housingCosts!.pmiRate).toBe(0);
    });

    it('opens a calculation saved before closing costs with no fees, and the usual prepaid interest and escrow', () => {
      const { closingCosts: _, ...saved } = last();

      const { sent } = restore(saved);

      expect(sent[0].closingCosts).toEqual({ loanCosts: 0, otherFees: 0, prepaidInterestDays: 15, escrowMonths: 3, credits: 0 });
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
        homePrice: 415_000, downPayment: 215_000, annualInterestRate: 6, termInMonths: 360, firstPaymentDate: '2021-11-01',
      }));
      expect(text('existing-loan')).toContain('payment 61 of 360 is next');
    });

    it("takes a shared ARM as its type when it is one (a 5/1 from today), or by its months otherwise", () => {
      const open = (nextResetIn: number) => {
        fixture = TestBed.createComponent(LoanFormComponent);
        component = fixture.componentInstance;
        emitted = [];
        component.calculate.subscribe((request) => emitted.push(request));
        fixture.componentRef.setInput('loan', {
          loan: { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 360, homeValue: 400_000,
            rate: { kind: 'arm', nextResetIn, intervalMonths: 12, expectedRate: 8, initialCap: 2, periodicCap: 1, lifetimeCap: 5 } },
          from: 'Pay off or invest', version: 1,
        });
        fixture.detectChanges();
        return emitted[0];
      };

      expect(open(60).adjustableRate).toEqual(expect.objectContaining({ initialFixedMonths: 60, adjustmentIntervalMonths: 12 }));
      expect(component.form.controls.rate.controls.armType.value).toBe('5/1');
      expect(open(30).adjustableRate).toEqual(expect.objectContaining({ initialFixedMonths: 30, adjustmentIntervalMonths: 12 }));
      expect(component.form.controls.rate.controls.armType.value).toBe('other');
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
        propertyTaxRate: 0.9, propertyTaxHomesteadExemption: 0, schoolTaxRate: 0, localTaxRate: 0, mudTaxRate: 0, over65OrDisabled: null,
      }));
      expect(text('taxes-summary')).toBe('Tax 0.9% · Homestead');
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
        year: 1, startDate: '2026-11-01', marketValue: 415_000, assessedValue: 415_000,
        schoolTaxableValue: null, localTaxableValue: null, mudTaxableValue: null, propertyTaxableValue: 365_000,
        costs: { propertyTax: 0, schoolTax: 0, localTax: 0, mudTax: 0, pidAssessment: 0, homeownersInsurance: 0, mortgageInsurance: 0, hoaDues: 0, total: 0 },
      });
      fixture.detectChanges();

      expect(text('homestead-savings')).toBe('In year 1 the exemption saves $450 in tax.'); // 0.9% of the $50,000 exempt
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

    it('points to the separate taxes for over-65 relief, which is set per tax', () => {
      fixture.detectChanges();
      expect(text('over-65-pointer')).toContain('Separate taxes');

      controls().taxMode.setValue('separate');
      fixture.detectChanges();
      expect(text('over-65-pointer')).toBeUndefined();
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
      expect(text('rate-summary')).toBe('2-1 buydown: 3.99% in year 1, 4.99% in year 2, then 5.99% · the seller pays for it');

      controls().rate.controls.buydownPlan.setValue('3-2-1');
      fixture.detectChanges();
      expect(last().buydown).toEqual({ yearlyReductions: [3, 2, 1] });
    });

    it('asks who pays for a buydown only once one is chosen, and sends the answer: the seller unless you did', () => {
      expect(el('buydown-paid-by')).toBeNull();
      expect(last().buydownPaidBy).toBe('Seller');

      controls().rate.controls.rateType.setValue('buydown');
      fixture.detectChanges();
      expect(el('buydown-paid-by')).not.toBeNull();

      (el('buydown-paid-by-you') as HTMLInputElement).click();
      fixture.detectChanges();
      expect(last().buydownPaidBy).toBe('Borrower');
      expect(text('rate-summary')).toContain('you pay for it');
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
        initialFixedMonths: 60, adjustmentIntervalMonths: 6, expectedRate: 7.5, initialCap: 5, periodicCap: 2, lifetimeCap: 5, margin: 2.75,
      });
      expect(text('rate-summary')).toBe('5/6 ARM: 6.5% for 5 yr, then toward 7.5% (caps 5/2/5, floor 2.75%)');
    });

    it("sends the ARM's margin as its floor, and a blank margin as none", () => {
      controls().rate.controls.rateType.setValue('arm');
      expect(last().adjustableRate?.margin).toBe(2.75);

      controls().rate.controls.armMargin.setValue(null);
      fixture.detectChanges();
      expect(last().adjustableRate?.margin).toBeNull();
      expect(text('rate-summary')).toBe('7/1 ARM: 6.5% for 7 yr, then toward 7.5% (caps 5/2/5)');
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

  describe('tax rate changes', () => {
    it('are added one at a time, and sent once they change a rate', () => {
      component.addRateChange();
      fixture.detectChanges();
      expect(last().housingCosts?.rateChanges).toEqual([]); // a blank change changes nothing, so it is not sent

      component.rateChanges.at(0).controls.propertyTaxRate.setValue(2.4);
      fixture.detectChanges();

      expect(last().housingCosts?.rateChanges).toEqual([{ fromYear: 2, propertyTaxRate: 2.4, schoolTaxRate: null, localTaxRate: null, mudTaxRate: null }]);
      expect(text('taxes-summary')).toBe('Tax 0.9% · Homestead · 1 rate change');
    });

    it('offer a field for each tax that is charged, and send only those', () => {
      controls().taxMode.setValue('separate');
      controls().mudTaxRate.setValue(0);
      component.addRateChange();
      fixture.detectChanges();
      const row = component.rateChanges.at(0).controls;

      row.fromYear.setValue(4);
      row.schoolTaxRate.setValue(0.9);
      row.mudTaxRate.setValue(0.5); // no MUD tax is charged, so this is not sent
      fixture.detectChanges();

      expect(el('rate-change-school')).not.toBeNull();
      expect(el('rate-change-mud')).toBeNull();
      expect(el('rate-change-property')).toBeNull();
      expect(last().housingCosts?.rateChanges).toEqual([{ fromYear: 4, propertyTaxRate: null, schoolTaxRate: 0.9, localTaxRate: null, mudTaxRate: null }]);
    });

    it('can be removed', () => {
      component.addRateChange();
      component.rateChanges.at(0).controls.propertyTaxRate.setValue(2.4);

      component.removeRateChange(0);

      expect(last().housingCosts?.rateChanges).toEqual([]);
    });

    it('send a ceiling brought from a former home with the over-65 relief', () => {
      controls().taxMode.setValue('separate');
      controls().isOver65.setValue(true);
      fixture.detectChanges();

      controls().transferredCeilingPercent.setValue(40);

      expect(last().housingCosts?.over65OrDisabled?.transferredCeilingPercent).toBe(40);
    });

    it('come back as they were saved', () => {
      component.addRateChange();
      component.rateChanges.at(0).controls.fromYear.setValue(6);
      component.rateChanges.at(0).controls.propertyTaxRate.setValue(2.4);
      const original = last();

      const restored = TestBed.createComponent(LoanFormComponent);
      const sent: AmortizationRequest[] = [];
      restored.componentInstance.calculate.subscribe((r) => sent.push(r));
      restored.componentRef.setInput('initial', original);
      restored.detectChanges();

      expect(sent[0].housingCosts?.rateChanges).toEqual(original.housingCosts?.rateChanges);
    });
  });

  describe('FHA and VA loans', () => {
    const choose = (type: 'Conventional' | 'Fha' | 'Va') => {
      controls().loanProgram.setValue(type);
      fixture.detectChanges();
    };

    it('say what each program asks for in one line, with the details a click away', () => {
      choose('Fha');
      const fha = [text('program-hint'), el('program-more')?.textContent?.replace(/\s+/g, ' ').trim()];
      choose('Va');
      const va = [text('program-hint'), el('program-more')?.textContent?.replace(/\s+/g, ' ').trim()];

      expect(fha[0]).toBe('At least 3.5% down, a 1.75% upfront fee, and a yearly MIP.');
      expect(fha[1]).toContain("More about FHA's MIP");
      expect(fha[1]).toContain('for 11 years with 10% or more down');
      expect(va[0]).toBe('No down payment needed and no mortgage insurance, but a one-time funding fee.');
      expect(va[1]).toContain('More about the funding fee');
      expect(va[1]).toContain('Veterans compensated for a service-connected disability are exempt.');
      expect(el('program-more')?.tagName).toBe('DETAILS');
    });

    it('are conventional unless chosen, with PMI', () => {
      expect(last().program).toBeNull();
      expect(last().housingCosts?.pmiRate).toBe(0.5);
      expect(text('program-summary')).toBe('Conventional');
    });

    it('send an FHA loan, its upfront MIP financed, and no PMI', () => {
      controls().downPayment.setValue(14_525); // 3.5% of $415,000
      choose('Fha');

      expect(last().program).toEqual({ type: 'Fha', vaUse: null, financeUpfrontFee: true, creditScore: null, countyFips: null });
      expect(last().housingCosts?.pmiRate).toBe(0);
      expect(text('program-summary')).toBe('FHA · upfront MIP added to the loan');
      expect(el('pmi-rate')).toBeNull();
      expect(text('pmi-hint')).toContain('FHA charges its own mortgage insurance');
    });

    it('need 3.5% down for FHA, or nothing is sent', () => {
      controls().downPayment.setValue(13_124);
      const sent = emitted.length;

      choose('Fha');

      expect(emitted).toHaveLength(sent);
      expect(text('fha-down-error')).toBe('An FHA loan needs at least 3.5% down.');
    });

    it('send an FHA loan with its credit score and county', () => {
      controls().downPayment.setValue(14_525);
      choose('Fha');
      controls().creditScore.setValue(640);
      controls().countyFips.setValue('48029');

      expect(last().program).toEqual({ type: 'Fha', vaUse: null, financeUpfrontFee: true, creditScore: 640, countyFips: '48029' });
    });

    it('need 10% down for FHA with a credit score below 580', () => {
      controls().downPayment.setValue(14_525);
      choose('Fha');
      const sent = emitted.length;

      controls().creditScore.setValue(579);
      fixture.detectChanges();

      expect(emitted).toHaveLength(sent);
      expect(text('fha-down-error')).toBe('With a credit score below 580, an FHA loan needs at least 10% down.');
    });

    it('refuse FHA below a credit score of 500', () => {
      controls().downPayment.setValue(83_000);
      choose('Fha');
      const sent = emitted.length;

      controls().creditScore.setValue(499);
      fixture.detectChanges();

      expect(emitted).toHaveLength(sent);
      expect(text('fha-down-error')).toBe('FHA insures loans only for credit scores of 500 or more.');
    });

    it('send a VA loan with its funding-fee use, which can be paid at closing', () => {
      choose('Va');
      controls().vaUse.setValue('SubsequentUse');
      controls().financeUpfrontFee.setValue(false);
      fixture.detectChanges();

      expect(last().program).toEqual({ type: 'Va', vaUse: 'SubsequentUse', financeUpfrontFee: false, creditScore: null, countyFips: null });
      expect(last().housingCosts?.pmiRate).toBe(0);
      expect(text('program-summary')).toBe('VA · used before · funding fee paid at closing');
      expect(text('pmi-hint')).toContain('VA loans have no mortgage insurance');
    });

    it('come back as they were saved', () => {
      choose('Va');
      controls().vaUse.setValue('Exempt');
      const original = last();

      const restored = TestBed.createComponent(LoanFormComponent);
      const sent: AmortizationRequest[] = [];
      restored.componentInstance.calculate.subscribe((r) => sent.push(r));
      restored.componentRef.setInput('initial', original);
      restored.detectChanges();

      expect(sent[0].program).toEqual({ type: 'Va', vaUse: 'Exempt', financeUpfrontFee: true, creditScore: null, countyFips: null });
    });
  });

  describe('discount points', () => {
    const turnOn = () => {
      controls().usePoints.setValue(true);
      fixture.detectChanges();
    };

    it('are off until chosen, and then sent with the rate the lender quotes without them', () => {
      expect(last().discountPoints).toBeNull();
      expect(el('points')).toBeNull();

      turnOn();

      expect(last().discountPoints).toEqual({ points: 1, rateWithoutPoints: 6.75 });
      expect(el('points')).not.toBeNull();
      expect(text('rate-summary')).toBe('Fixed for the whole loan · 1 point');
    });

    it('start the rate without points above the loan rate, whatever the rate', () => {
      controls().annualInterestRate.setValue(7.25);

      turnOn();

      expect(last().discountPoints).toEqual({ points: 1, rateWithoutPoints: 7.5 });
    });

    it('need the rate without points to be higher, or nothing is sent', () => {
      turnOn();
      const sent = emitted.length;
      const reports: string[][] = [];
      component.problems.subscribe((p) => reports.push(p));

      controls().rateWithoutPoints.setValue(6.5);
      fixture.detectChanges();

      expect(emitted).toHaveLength(sent);
      expect(text('points-rate-error')).toBe('The rate without points must be higher than the rate with them.');
      expect(reports.at(-1)).toContain('The rate without points must be higher than the rate with them.');
    });

    it('are not offered on an adjustable rate, where the two rates would reset differently', () => {
      turnOn();

      controls().rate.controls.rateType.setValue('arm');
      fixture.detectChanges();

      expect(el('use-points')).toBeNull();
      expect(last().discountPoints).toBeNull();
    });

    it('say "points" for more than one', () => {
      turnOn();
      controls().points.setValue(2);
      fixture.detectChanges();

      expect(text('rate-summary')).toBe('Fixed for the whole loan · 2 points');
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
        .toEqual(expect.objectContaining({ homePrice: 415_000, downPayment: 115_000 }));
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
      controls().downPayment.setValue(415_000);

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
      controls().downPayment.setValue(415_000);
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
      expect(el('pmi-hint')?.textContent).toContain('Ask your lender to remove it at 80% of the price, and extra payments bring that sooner');
      expect((el('pmi-cancellation') as HTMLSelectElement).value).toBe('BorrowerRequested');

      controls().downPayment.setValue(83_000);
      fixture.detectChanges();

      expect(el('pmi-hint')?.textContent).toContain('No PMI');
    });

    it('formats numbers with thousands separators and shows the unit inside the box', () => {
      const price = el('home-price') as HTMLInputElement;

      expect(price.type).toBe('text');
      expect(price.value).toBe('415,000');
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
