import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StrategyRequest } from '../../../core/models/strategy.models';
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

  it('flags the IRA limit once touched', () => {
    const root = render();

    controls().annualIraContribution.setValue(8_000);
    controls().annualIraContribution.markAsTouched();
    fixture.detectChanges();

    expect(root.textContent).toContain('At most $7,500 (the 2026 limit).');
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
