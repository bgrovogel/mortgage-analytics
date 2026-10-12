import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StrategyRequest } from '../../../core/models/strategy.models';
import { StrategyNumberField } from './strategy-fields';
import { StrategyFormComponent } from './strategy-form.component';

describe('StrategyFormComponent', () => {
  let fixture: ComponentFixture<StrategyFormComponent>;
  let emitted: StrategyRequest[];

  const render = (initial: StrategyRequest | null = null) => {
    fixture = TestBed.createComponent(StrategyFormComponent);
    emitted = [];
    fixture.componentInstance.compare.subscribe((r) => emitted.push(r));
    fixture.componentRef.setInput('initial', initial);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const text = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`)!.textContent!.replace(/\s+/g, ' ').trim();
  const controls = () => fixture.componentInstance.form.controls;

  it('marks the mortgage as shared in its heading, and groups the household details under More details', () => {
    const root = render();

    expect(text(root, 'shared-tag')).toBe('Shared across pages');
    expect([...root.querySelectorAll('[data-testid="more-details"] details.section')].map((d) => d.getAttribute('data-testid')))
      .toEqual(['section-taxes', 'section-savings', 'section-stock', 'section-market']);
  });

  it('says the numbers are an example until the first edit, and never for a restored comparison', () => {
    const root = render();
    expect(text(root, 'example-note')).toContain('example numbers');

    controls().currentBalance.setValue(250_000);
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="example-note"]')).toBeNull();

    const restored = render(emitted[emitted.length - 1]);
    expect(restored.querySelector('[data-testid="example-note"]')).toBeNull();
  });

  it('compares the typical household at once, sending years left as months', () => {
    render();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(expect.objectContaining({
      currentBalance: 300_000,
      annualInterestRate: 6.5,
      remainingTermInMonths: 300,
      nextPaymentDate: null,
      filingStatus: 'MarriedFilingJointly',
      riskProfile: 'Balanced',
      employerMatchPercent: 50,
      annualIraContribution: 7_500,
      expectedAnnualReturn: 10,
      sellRsusAtVest: false,
    }));
  });

  it('starts from a loan changed on another page, and says so', () => {
    fixture = TestBed.createComponent(StrategyFormComponent);
    emitted = [];
    fixture.componentInstance.compare.subscribe((r) => emitted.push(r));
    fixture.componentRef.setInput('loan', {
      loan: { balance: 356_250, annualInterestRate: 6, remainingTermInMonths: 360, homeValue: 375_000 }, from: 'Calculator', version: 1,
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(emitted[0]).toEqual(expect.objectContaining({
      currentBalance: 356_250, annualInterestRate: 6, remainingTermInMonths: 360, homeValue: 375_000, monthlyCashToPutToWork: 1_000,
    }));
    expect(text(root, 'loan-shared')).toContain('Filled in from your loan on the Calculator page.');
  });

  it('keeps its home value when the shared loan has none, and says nothing when the loan is already the same', () => {
    fixture = TestBed.createComponent(StrategyFormComponent);
    emitted = [];
    fixture.componentInstance.compare.subscribe((r) => emitted.push(r));
    fixture.componentRef.setInput('loan', {
      loan: { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 300, homeValue: null }, from: 'Refinance', version: 1,
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(emitted[0].homeValue).toBe(400_000);
    expect(root.querySelector('[data-testid="loan-shared"]')).toBeNull();
  });

  it('takes the shared rate type: an ARM by its next reset, or a buydown', () => {
    const open = (rate: object) => {
      fixture = TestBed.createComponent(StrategyFormComponent);
      emitted = [];
      fixture.componentInstance.compare.subscribe((r) => emitted.push(r));
      fixture.componentRef.setInput('loan', {
        loan: { balance: 300_000, annualInterestRate: 6.5, remainingTermInMonths: 300, homeValue: 400_000, rate }, from: 'Refinance', version: 1,
      });
      fixture.detectChanges();
      return emitted[0];
    };

    expect(open({ kind: 'arm', nextResetIn: 24, intervalMonths: 6, expectedRate: 8, initialCap: 2, periodicCap: 1, lifetimeCap: 5 }).adjustableRate)
      .toEqual({ initialFixedMonths: 24, adjustmentIntervalMonths: 6, expectedRate: 8, initialCap: 2, periodicCap: 1, lifetimeCap: 5, margin: null });
    expect(text(fixture.nativeElement, 'loan-shared')).toContain('Filled in from your loan on the Refinance page.');
    expect(open({ kind: 'buydown', yearlyReductions: [3, 2, 1] }).buydown).toEqual({ yearlyReductions: [3, 2, 1] });
  });

  it('starts from an earlier comparison', () => {
    render();
    const earlier = { ...emitted[0], currentBalance: 250_000, remainingTermInMonths: 240, riskProfile: 'Conservative' as const };

    render(earlier);

    expect(controls().yearsLeft.value).toBe(20);
    expect(emitted[0]).toEqual(earlier);
  });

  it('sends a new request on every valid change, and none while invalid', () => {
    render();

    controls().monthlyCashToPutToWork.setValue(2_000);
    controls().annualIraContribution.setValue(8_000);

    expect(emitted).toHaveLength(2);
    expect(emitted[1].monthlyCashToPutToWork).toBe(2_000);
  });

  it('checks every number against the limits the API enforces, and says why in plain words', () => {
    const root = render();
    const outOfRange: [StrategyNumberField, string, number, string][] = [
      ['currentBalance', 'balance', 0, 'Balance you owe must be more than $0.'],
      ['annualInterestRate', 'rate', 31, 'Interest rate must be between 0% and 30%.'],
      ['yearsLeft', 'years-left', 31, 'Years left must be between 1 month and 30 years.'],
      ['homeValue', 'home-value', 100_000_001, 'Home value must be between $0 and $100,000,000.'],
      ['marginalTaxRate', 'tax-rate', 61, 'Tax rate must be between 0% and 60%.'],
      ['employerMatchPercent', 'match-percent', 201, 'Employer match must be between 0% and 200%.'],
      ['annualIraContribution', 'ira', 8_000, 'IRA contributions must be between $0 and $7,500.'],
      ['esppDiscountPercent', 'espp-discount', 16, 'ESPP discount must be between 0% and 15%.'],
      ['esppPurchasePeriodMonths', 'espp-period', 6.5, 'ESPP purchase period: whole numbers only.'],
      ['expectedAnnualReturn', 'expected-return', -11, 'Stock return must be between -10% and 30%.'],
      ['inflationRate', 'inflation', 21, 'Inflation must be between -5% and 20%.'],
      ['homeGrowthRate', 'home-growth', 26, 'Home value growth must be between -20% and 25%.'],
    ];

    for (const [field, testId, value, message] of outOfRange) {
      const control = controls()[field];
      const before = control.value;
      control.setValue(value as never);
      control.markAsDirty();
      fixture.detectChanges();

      expect(text(root, `error-${testId}`)).toBe(message);
      control.setValue(before as never);
      fixture.detectChanges();
    }
    expect(emitted.every((r) => r.annualInterestRate <= 30 && r.annualIraContribution <= 7_500)).toBe(true); // nothing invalid was sent
  });

  it('accepts the edges of every range', () => {
    render();

    controls().employerMatchPercent.setValue(200);
    controls().matchUpToPercentOfPay.setValue(100);
    controls().yearsLeft.setValue(30);
    controls().annualIraContribution.setValue(7_500);
    controls().expectedAnnualReturn.setValue(-10);

    expect(fixture.componentInstance.form.valid).toBe(true);
    expect(emitted[emitted.length - 1]).toEqual(expect.objectContaining({ employerMatchPercent: 200, remainingTermInMonths: 360, expectedAnnualReturn: -10 }));
  });

  it('asks for a number when a box is emptied', () => {
    const root = render();

    controls().grossAnnualIncome.setValue(null as never);
    controls().grossAnnualIncome.markAsDirty();
    fixture.detectChanges();

    expect(text(root, 'error-income')).toBe('Gross income: enter a number.');
  });

  it('reports what is wrong as it changes, so the page can say its results are stale', () => {
    render();
    const reports: string[][] = [];
    fixture.componentInstance.problems.subscribe((p) => reports.push(p));
    const sent = emitted.length;

    controls().marginalTaxRate.setValue(70);
    controls().inflationRate.setValue(25);
    controls().marginalTaxRate.setValue(24);
    controls().inflationRate.setValue(3);

    expect(reports).toEqual([
      [], // the form starts out valid
      ['Tax rate must be between 0% and 60%.'],
      ['Tax rate must be between 0% and 60%.', 'Inflation must be between -5% and 20%.'],
      ['Inflation must be between -5% and 20%.'],
      [],
    ]);
    expect(emitted.length - sent).toBe(1); // only once everything was valid again
  });

  it('says what the risk profile counts on, and that market returns are not guaranteed', () => {
    const root = render();
    expect(text(root, 'counting-on')).toContain('Market returns are not guaranteed; paying down the mortgage is.');
    expect(text(root, 'counting-on')).toContain('counting on 8% a year');

    (root.querySelector('[data-testid="risk-Conservative"]') as HTMLInputElement).click();
    fixture.detectChanges();

    expect(text(root, 'counting-on')).toContain('counting on 6% a year');
    expect(emitted[emitted.length - 1].riskProfile).toBe('Conservative');
  });

  it('summarizes each collapsed section in one line', () => {
    const root = render();
    expect(text(root, 'taxes-summary')).toBe('$120,000 · 24% · Married filing jointly');
    expect(text(root, 'savings-summary')).toBe('50% match on 6% of pay · IRA $7,500/yr');
    expect(text(root, 'stock-summary')).toBe('None');
    expect(text(root, 'market-summary')).toBe('Stocks 10% · Inflation 3% · Home 4.3%');

    controls().employerMatchPercent.setValue(0);
    controls().annualRsuVesting.setValue(30_000);
    controls().annualEsopContribution.setValue(5_000);
    controls().esppContributionPercent.setValue(10);
    fixture.detectChanges();

    expect(text(root, 'savings-summary')).toBe('No match · IRA $7,500/yr');
    expect(text(root, 'stock-summary')).toBe('RSUs $30,000/yr · ESOP $5,000/yr · ESPP 10% of pay');
  });
});
