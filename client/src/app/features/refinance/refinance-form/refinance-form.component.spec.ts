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
      originalLoan: null,
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

      // $300,000 owed at 7% with 25 years left: a 30-year loan of $318,702.79, first paid five years ago.
      expect(controls().originalAmount.value).toBe(318_702.79);
      expect(controls().originalTermYears.value).toBe(30);
      expect(controls().firstPaymentDate.value).toBe('2021-11-01');
      expect(last()).toEqual(expect.objectContaining({
        currentBalance: 300_000,
        remainingTermInMonths: 300,
        originalLoan: { amount: 318_702.79, termInMonths: 360, firstPaymentDate: '2021-11-01' },
      }));
      expect(el('original-loan-today')!.textContent).toContain('Payment 61 of 360 is next, with about $300,000 owed.');
    });

    it('works out what is owed and the payments left from the original loan, and turns back into them', () => {
      create();
      pick('original');

      controls().originalAmount.setValue(200_000);
      controls().currentAnnualInterestRate.setValue(6);
      fixture.detectChanges();

      expect(last()).toEqual(expect.objectContaining({ currentBalance: 186_108.71, remainingTermInMonths: 300 }));
      expect(el('new-term')!.textContent).toContain('Keep my payoff date (25 years)');

      pick('today');

      expect(controls().currentBalance.value).toBe(186_108.71);
      expect(controls().yearsLeft.value).toBe(25);
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
        newAnnualInterestRate: 5, newTermInMonths: 360, closingCosts: 4_000, financeClosingCosts: false,
        originalLoan: { amount: 200_000, termInMonths: 360, firstPaymentDate: '2021-11-01' },
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
      newAnnualInterestRate: 5.75, newTermInMonths: 240, closingCosts: 4_500, financeClosingCosts: true, originalLoan: null,
    };

    create(previous);

    expect(emitted).toEqual([previous]);
    expect(controls().newTerm.value).toBe('keep');
  });
});
