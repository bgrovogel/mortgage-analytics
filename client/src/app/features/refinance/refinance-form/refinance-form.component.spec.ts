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

  it('asks one question at a time on a phone: the loan today, then the new loan, with the verdict beside it', () => {
    create();
    expect(el('step-today')!.classList).not.toContain('step-off');
    expect(el('step-new')!.classList).toContain('step-off');
    expect(el('refi-steps')!.textContent).toContain('Step 1 of 2');

    (el('refi-next') as HTMLButtonElement).click();
    fixture.componentRef.setInput('verdict', 'Saves $14,067 · break-even Jul 2029');
    fixture.detectChanges();

    expect(el('step-today')!.classList).toContain('step-off');
    expect(el('step-new')!.classList).not.toContain('step-off');
    expect(el('refi-steps')!.textContent).toContain('Step 2 of 2');
    expect(el('refi-live-verdict')!.textContent).toContain('Saves $14,067 · break-even Jul 2029');

    (el('refi-back') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el('step-today')!.classList).not.toContain('step-off');
  });

  it('titles the two rate sections by the loan they are for, so a screen reader can tell them apart', () => {
    create();
    const title = (id: string) => el(id)!.querySelector('.section-title')!.textContent!.trim();

    expect(title('section-current-rate')).toBe('Current rate type');
    expect(title('section-new-rate')).toBe('New rate type');
  });

  it('marks the loan as shared in its heading, and says where it came from only when it was filled in', () => {
    create();

    expect(el('shared-tag')?.textContent).toBe('Shared with the other pages');
    expect(el('loan-shared')).toBeNull();
  });

  it('says the numbers are an example until the first edit, and never for a restored comparison', () => {
    create();
    expect(el('example-note')?.textContent).toContain('example numbers');

    controls().currentBalance.setValue(250_000);
    fixture.detectChanges();
    expect(el('example-note')).toBeNull();

    create(last());
    expect(el('example-note')).toBeNull();
  });

  it('starts with a worked example that shows the clock restarting, and compares it at once', () => {
    create();

    expect(emitted).toEqual([{
      currentBalance: 300_000,
      currentAnnualInterestRate: 7,
      remainingTermInMonths: 336,
      nextPaymentDate: null,
      newAnnualInterestRate: 6.25,
      newTermInMonths: 360,
      closingCosts: 6_000,
      financeClosingCosts: false,
      cashOut: 0,
      originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
      homeValue: 400_000, currentMonthlyPmi: 0, newPmiRate: 0.5,
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

    expect(options).toEqual(['30 years', '25 years', '20 years', '15 years', '10 years', 'My payoff date']); // short enough for the box

    controls().newTerm.setValue('keep');
    fixture.detectChanges();
    expect(el('keep-term-hint')!.textContent!.trim()).toBe('Ends when your loan does: 28 years.');
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
      currentBalance: 250_000, currentAnnualInterestRate: 7.25, remainingTermInMonths: 270, newAnnualInterestRate: 6.25, closingCosts: 6_000,
    }));
    expect(el('loan-shared')!.textContent).toContain('Filled in from your loan on the Pay off or invest page.');
  });

  describe('the loan as it was taken out', () => {
    beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 9, 10), doNotFake: ['nextTick', 'setImmediate'] }));
    afterEach(() => jest.useRealTimers());

    const pick = (entry: 'today' | 'original') => {
      (el(`loan-entry-${entry}`) as HTMLInputElement).click();
      fixture.detectChanges();
    };

    it('turns what is owed now into the same loan as it was taken out, and sends both', () => {
      create();

      pick('original');

      // $300,000 owed at 7% with 28 years left: a 30-year loan of $306,450.95, first paid two years ago.
      expect(controls().originalAmount.value).toBe(306_450.95);
      expect(controls().originalTermYears.value).toBe(30);
      expect(controls().firstPaymentDate.value).toBe('2024-11-01');
      expect(last()).toEqual(expect.objectContaining({
        currentBalance: 300_000,
        remainingTermInMonths: 336,
        originalLoan: { amount: 306_450.95, termInMonths: 360, firstPaymentDate: '2024-11-01' },
      }));
      expect(el('original-loan-today')!.textContent).toContain('Payment 25 of 360 is next, with about $300,000 owed.');
    });

    it('works out what is owed and the payments left from the original loan, and turns back into them', () => {
      create();
      pick('original');

      controls().originalAmount.setValue(200_000);
      controls().currentAnnualInterestRate.setValue(6);
      fixture.detectChanges();

      expect(last()).toEqual(expect.objectContaining({ currentBalance: 194_936.47, remainingTermInMonths: 336 }));
      controls().newTerm.setValue('keep');
      fixture.detectChanges();
      expect(el('keep-term-hint')!.textContent).toContain('Ends when your loan does: 28 years.');
      controls().newTerm.setValue('30');

      pick('today');

      expect(controls().currentBalance.value).toBe(194_936.47);
      expect(controls().yearsLeft.value).toBe(28);
      expect(last().originalLoan).toBeNull();
    });

    it('will not send an original loan whose whole term is behind it', () => {
      create();
      pick('original');
      const sent = emitted.length;
      const reports: string[][] = [];
      component.problems.subscribe((p) => reports.push(p));

      controls().firstPaymentDate.setValue('1990-01-01');
      fixture.detectChanges();

      expect(emitted).toHaveLength(sent);
      expect(reports[reports.length - 1]).toEqual(['With that first payment, the whole term is already behind you: pick a later date or a longer term.']);
    });

    it('reopens a comparison saved with its original loan, described the same way', () => {
      const saved: RefinanceRequest = {
        currentBalance: 186_108.71, currentAnnualInterestRate: 6, remainingTermInMonths: 300, nextPaymentDate: null,
        newAnnualInterestRate: 5, newTermInMonths: 360, closingCosts: 4_000, financeClosingCosts: false, cashOut: 0,
        originalLoan: { amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' },
        currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
        homeValue: 260_000, currentMonthlyPmi: 95, newPmiRate: 0.6,
      };

      create(saved);

      expect(controls().loanEntry.value).toBe('original');
      expect(emitted).toEqual([saved]);
    });

    it('starts from a loan whose start another page knows, as it was taken out', () => {
      fixture = TestBed.createComponent(RefinanceFormComponent);
      component = fixture.componentInstance;
      emitted = [];
      component.analyze.subscribe((r) => emitted.push(r));
      fixture.componentRef.setInput('loan', {
        loan: { balance: 186_108.71, annualInterestRate: 6, remainingTermInMonths: 300, homeValue: 250_000,
          start: { amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' } },
        from: 'Calculator', version: 2,
      });
      fixture.detectChanges();

      expect(controls().loanEntry.value).toBe('original');
      expect(emitted[0]).toEqual(expect.objectContaining({
        currentBalance: 186_108.71, remainingTermInMonths: 300, originalLoan: { amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' },
      }));
      expect(el('loan-shared')!.textContent).toContain('Filled in from your loan on the Calculator page.');
    });
  });

  it('restores a previous comparison instead of the example', () => {
    const previous: RefinanceRequest = {
      currentBalance: 250_000, currentAnnualInterestRate: 7.5, remainingTermInMonths: 240, nextPaymentDate: null,
      newAnnualInterestRate: 5.75, newTermInMonths: 240, closingCosts: 4_500, financeClosingCosts: true, cashOut: 0, originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
      homeValue: 300_000, currentMonthlyPmi: 110, newPmiRate: 0.5,
    };

    create(previous);

    expect(emitted).toEqual([previous]);
    expect(controls().newTerm.value).toBe('keep');
  });

  describe('a home-equity loan for the cash out', () => {
    it('offers the comparison only once cash is taken out, and sends nothing for it until asked', () => {
      create();
      expect(el('compare-equity-loan')).toBeNull();

      controls().cashOut.setValue(50_000);
      fixture.detectChanges();

      expect(el('compare-equity-loan')).not.toBeNull();
      expect(el('equity-rate')).toBeNull();
      expect(last().homeEquityLoan).toBeUndefined();
    });

    it('sends the loan to compare once asked: its rate, its term in months and the years kept', () => {
      create();
      controls().cashOut.setValue(50_000);
      controls().compareEquityLoan.setValue(true);
      fixture.detectChanges();
      expect(el('equity-rate')).not.toBeNull();

      controls().equityRate.setValue(8.5);
      controls().equityTermYears.setValue(10);
      controls().equityYearsKept.setValue(5);

      expect(last().homeEquityLoan).toEqual({ annualInterestRate: 8.5, termInMonths: 120, yearsKept: 5 });
    });

    it('drops the loan again when the cash out goes back to nothing', () => {
      create();
      controls().cashOut.setValue(50_000);
      controls().compareEquityLoan.setValue(true);
      controls().cashOut.setValue(0);

      expect(last().homeEquityLoan).toBeUndefined();
    });

    describe('as a line of credit', () => {
      const askForALine = () => {
        create();
        controls().cashOut.setValue(50_000);
        controls().compareEquityLoan.setValue(true);
        fixture.detectChanges();
      };
      const pick = (kind: 'loan' | 'line') => {
        (el(`equity-kind-${kind}`) as HTMLInputElement).click();
        fixture.detectChanges();
      };

      it('is a loan until a line is chosen, with the line fields kept out of the way', () => {
        askForALine();

        expect((el('equity-kind-loan') as HTMLInputElement).checked).toBe(true);
        expect(el('equity-draw-years')).toBeNull();
        expect(el('equity-repayment-rate')).toBeNull();
        expect(last().homeEquityLoan).toEqual({ annualInterestRate: 8, termInMonths: 180, yearsKept: 7 });
      });

      it('asks for the draw period and the rate once repaying, and sends them in months and percent', () => {
        askForALine();

        pick('line');
        expect(el('equity-draw-years')).not.toBeNull();
        expect(el('equity-repayment-rate')).not.toBeNull();
        controls().equityRate.setValue(8);
        controls().equityDrawYears.setValue(10);
        controls().equityTermYears.setValue(20);
        controls().equityRepaymentRate.setValue(9);

        expect(last().homeEquityLoan).toEqual({ annualInterestRate: 8, termInMonths: 240, yearsKept: 7, drawPeriodInMonths: 120, repaymentRate: 9 });
      });

      it('goes back to a plain loan, sending neither of the line fields', () => {
        askForALine();
        pick('line');
        pick('loan');

        expect(last().homeEquityLoan).toEqual({ annualInterestRate: 8, termInMonths: 180, yearsKept: 7 });
        expect(el('equity-draw-years')).toBeNull();
      });

      it('is invalid with a draw period above 30 years, and sends nothing until it is fixed', () => {
        askForALine();
        pick('line');
        const sent = emitted.length;

        controls().equityDrawYears.setValue(31);

        expect(controls().equityDrawYears.valid).toBe(false);
        expect(emitted.length).toBe(sent);
      });

      it('reopens a saved line as a line, with its draw period in years and its rate once repaying', () => {
        const saved: RefinanceRequest = {
          currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
          newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false, cashOut: 50_000,
          originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
          homeValue: 500_000, currentMonthlyPmi: 0, newPmiRate: 0.5,
          homeEquityLoan: { annualInterestRate: 8, termInMonths: 240, yearsKept: 7, drawPeriodInMonths: 120, repaymentRate: 9 },
        };

        create(saved);

        expect(controls().equityKind.value).toBe('line');
        expect(controls().equityDrawYears.value).toBe(10);
        expect(controls().equityRepaymentRate.value).toBe(9);
        expect(emitted).toEqual([saved]);
      });

      it('reopens a saved line with no expected rate as one repaid at its own rate', () => {
        create({
          currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
          newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false, cashOut: 50_000,
          originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
          homeValue: 500_000, currentMonthlyPmi: 0, newPmiRate: 0.5,
          homeEquityLoan: { annualInterestRate: 8, termInMonths: 240, yearsKept: 7, drawPeriodInMonths: 120 },
        });

        expect(controls().equityRepaymentRate.value).toBe(8);
      });
    });

    it('reopens a saved comparison with its home-equity loan, asked for again', () => {
      const saved: RefinanceRequest = {
        currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
        newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false, cashOut: 50_000,
        originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
        homeValue: 500_000, currentMonthlyPmi: 0, newPmiRate: 0.5,
        homeEquityLoan: { annualInterestRate: 8, termInMonths: 180, yearsKept: 7 },
      };

      create(saved);

      expect(controls().compareEquityLoan.value).toBe(true);
      expect(controls().equityTermYears.value).toBe(15);
      expect(emitted).toEqual([saved]);
    });
  });

  describe('a debt paid off with the cash out', () => {
    const askToPayOffADebt = () => {
      create();
      controls().cashOut.setValue(50_000);
      controls().payOffDebt.setValue(true);
      fixture.detectChanges();
    };

    it('is offered once cash is taken out, and sends nothing for it until asked', () => {
      create();
      expect(el('pay-off-debt')).toBeNull();

      controls().cashOut.setValue(50_000);
      fixture.detectChanges();

      expect(el('pay-off-debt')).not.toBeNull();
      expect(el('debt-balance')).toBeNull();
      expect(last().debtPayoff).toBeUndefined();
    });

    it('sends the debt once asked: its balance, rate, payment and the years kept', () => {
      askToPayOffADebt();
      expect(el('debt-balance')).not.toBeNull();

      controls().debtBalance.setValue(20_000);
      controls().debtRate.setValue(22);
      controls().debtPayment.setValue(600);
      controls().debtYearsKept.setValue(5);

      expect(last().debtPayoff).toEqual({ balance: 20_000, annualInterestRate: 22, monthlyPayment: 600, yearsKept: 5 });
    });

    it('sends nothing while the debt is larger than the cash out, and says so', () => {
      askToPayOffADebt();
      const problems: string[][] = [];
      fixture.componentInstance.problems.subscribe((p) => problems.push(p));
      const before = emitted.length;

      controls().debtBalance.setValue(60_000);
      controls().debtPayment.setValue(2_000);
      fixture.detectChanges();

      expect(emitted).toHaveLength(before);
      expect(problems[problems.length - 1]).toContain("Take out at least the debt's balance for the cash to pay it off.");
    });

    it('sends nothing while the payment would not cover a month of interest, and says so', () => {
      askToPayOffADebt();
      const problems: string[][] = [];
      fixture.componentInstance.problems.subscribe((p) => problems.push(p));
      controls().debtBalance.setValue(20_000);
      controls().debtRate.setValue(22);
      const before = emitted.length;

      controls().debtPayment.setValue(366.67); // a month's interest to the cent: nothing is paid down
      fixture.detectChanges();

      expect(emitted).toHaveLength(before);
      expect(problems[problems.length - 1]).toContain("The payment must be more than a month's interest, or the debt never shrinks.");
    });

    it('drops the debt again when the cash out goes back to nothing', () => {
      askToPayOffADebt();
      expect(last().debtPayoff).toBeDefined();

      controls().cashOut.setValue(0);

      expect(last().debtPayoff).toBeUndefined();
    });

    it('reopens a saved comparison with its debt, asked for again', () => {
      const saved: RefinanceRequest = {
        currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
        newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false, cashOut: 50_000,
        originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null,
        homeValue: 500_000, currentMonthlyPmi: 0, newPmiRate: 0.5,
        debtPayoff: { balance: 20_000, annualInterestRate: 22, monthlyPayment: 600, yearsKept: 7 },
      };

      create(saved);

      expect(controls().payOffDebt.value).toBe(true);
      expect(controls().debtBalance.value).toBe(20_000);
      expect(emitted).toEqual([saved]);
    });
  });

  describe('discount points on the new loan', () => {
    const buy = () => {
      controls().buyPoints.setValue(true);
      fixture.detectChanges();
    };

    it('offers them for a fixed rate, and sends nothing for them until asked', () => {
      create();

      expect(el('buy-points')).not.toBeNull();
      expect(el('points')).toBeNull();
      expect(last().newDiscountPoints).toBeUndefined();
    });

    it('sends the points and the rate without them once asked', () => {
      create();
      controls().newAnnualInterestRate.setValue(6);
      buy();
      expect(el('points')).not.toBeNull();

      controls().points.setValue(1.5);
      controls().rateWithoutPoints.setValue(6.375);

      expect(last().newDiscountPoints).toEqual({ points: 1.5, rateWithoutPoints: 6.375 });
    });

    it('starts the rate without points a quarter above the new rate, and keeps it above as the rate moves, until it is typed', () => {
      create();
      buy();
      expect(controls().rateWithoutPoints.value).toBe(6.5); // the example's 6.25% and a quarter

      controls().newAnnualInterestRate.setValue(7);
      expect(controls().rateWithoutPoints.value).toBe(7.25);
    });

    it('sends nothing while the rate without points is not above the new rate, and says so', () => {
      create();
      buy();
      controls().rateWithoutPoints.setValue(6.5);
      controls().rateWithoutPoints.markAsDirty();
      const before = emitted.length;

      controls().newAnnualInterestRate.setValue(6.75);
      fixture.detectChanges();

      expect(emitted).toHaveLength(before);
    });

    it('is not offered for an adjustable rate or a buydown, and is dropped from what is sent', () => {
      create();
      buy();
      expect(last().newDiscountPoints).toBeDefined();

      controls().newRate.controls.rateType.setValue('buydown');
      fixture.detectChanges();

      expect(el('buy-points')).toBeNull();
      expect(last().newDiscountPoints).toBeUndefined();
    });

    it('reopens a saved comparison with its points, asked for again', () => {
      const saved: RefinanceRequest = {
        currentBalance: 300_000, currentAnnualInterestRate: 7, remainingTermInMonths: 300, nextPaymentDate: null,
        newAnnualInterestRate: 6, newTermInMonths: 360, closingCosts: 6_000, financeClosingCosts: false,
        originalLoan: null, currentAdjustableRate: null, newAdjustableRate: null, newBuydown: null, cashOut: 0,
        homeValue: 400_000, currentMonthlyPmi: 0, newPmiRate: 0.5,
        newDiscountPoints: { points: 1, rateWithoutPoints: 6.25 },
      };

      create(saved);

      expect(controls().buyPoints.value).toBe(true);
      expect(controls().rateWithoutPoints.value).toBe(6.25);
      expect(emitted).toEqual([saved]);
    });
  });

  describe('PMI', () => {
    it("takes the home's value and today's PMI from another page's loan", () => {
      fixture = TestBed.createComponent(RefinanceFormComponent);
      component = fixture.componentInstance;
      emitted = [];
      component.analyze.subscribe((r) => emitted.push(r));
      fixture.componentRef.setInput('loan', {
        loan: { balance: 356_250, annualInterestRate: 6.5, remainingTermInMonths: 360, homeValue: 375_000, monthlyPmi: 148.44 },
        from: 'Calculator', version: 2,
      });
      fixture.detectChanges();

      expect(emitted[0]).toEqual(expect.objectContaining({ homeValue: 375_000, currentMonthlyPmi: 148.44, newPmiRate: 0.5 }));
    });

    it('sends what is typed', () => {
      create();

      controls().homeValue.setValue(350_000);
      controls().currentMonthlyPmi.setValue(120);
      controls().newPmiRate.setValue(0.4);

      expect(emitted[emitted.length - 1]).toEqual(expect.objectContaining({ homeValue: 350_000, currentMonthlyPmi: 120, newPmiRate: 0.4 }));
    });
  });
});
