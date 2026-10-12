import { TestBed } from '@angular/core/testing';
import { aHousingCosts, aResponse, aSchedule } from '../../../../testing/builders';
import { LoanProgramSummary } from '../../../core/models/amortization.models';
import { ProgramSummaryComponent } from './program-summary.component';

describe('ProgramSummaryComponent', () => {
  /** $300,000 with 3.5% down at 6.5% (tools/calculator-check). */
  const fha: LoanProgramSummary = {
    type: 'Fha', upfrontFeePercent: 1.75, upfrontFee: 5_066.25, upfrontFeeFinanced: true, loanAmount: 294_566.25,
    annualMipPercent: 0.55, mipPayments: 360,
  };
  const va: LoanProgramSummary = {
    type: 'Va', upfrontFeePercent: 2.15, upfrontFee: 8_600, upfrontFeeFinanced: true, loanAmount: 408_600, annualMipPercent: 0, mipPayments: 0,
  };

  const render = (program: LoanProgramSummary | null) => {
    const fixture = TestBed.createComponent(ProgramSummaryComponent);
    fixture.componentRef.setInput('result', aResponse({
      program,
      baseline: aSchedule({ monthlyHousingCosts: aHousingCosts({ mortgageInsurance: program?.type === 'Fha' ? 134.33 : 0 }) }),
    }));
    fixture.detectChanges();
    return (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  };

  it('shows nothing for a conventional loan', () => {
    expect(render(null)('program-summary')).toBeUndefined();
  });

  it('explains an FHA loan: the upfront MIP borrowed, and the annual MIP for the whole term', () => {
    const text = render(fha);

    expect(text('program-title')).toBe('FHA loan');
    expect(text('program-note')).toBe(
      'The 1.75% upfront MIP, $5,066.25, is added to the loan, so you borrow $294,566.25. The annual MIP is 0.55% of '
      + 'the balance, $134.33 a month in year 1, for the whole loan: with 10% or more down it would end after 11 years.');
  });

  it('says when FHA MIP ends after 11 years, and when the upfront MIP is paid at closing', () => {
    const text = render({ ...fha, upfrontFeeFinanced: false, loanAmount: 289_500, annualMipPercent: 0.5, mipPayments: 132 });

    expect(text('program-note')).toBe(
      'The 1.75% upfront MIP, $5,066.25, is paid at closing, so you borrow $289,500.00. The annual MIP is 0.50% of '
      + 'the balance, $134.33 a month in year 1, for 11 years.');
  });

  it("names the county's limit when the loan has one", () => {
    const text = render({ ...fha, countyName: 'Bexar County, TX', countyLoanLimit: 557_750, loanLimitYear: 2026 });

    expect(text('program-note')).toContain("FHA's 2026 limit in Bexar County, TX is $557,750.");
  });

  it('explains a VA loan: the funding fee, and no mortgage insurance', () => {
    const text = render(va);

    expect(text('program-title')).toBe('VA loan');
    expect(text('program-note')).toBe('The 2.15% funding fee, $8,600.00, is added to the loan, so you borrow $408,600.00. There is no mortgage insurance, whatever the down payment.');
  });

  it('says when a VA loan is exempt from the funding fee', () => {
    expect(render({ ...va, upfrontFeePercent: 0, upfrontFee: 0, loanAmount: 400_000 })('program-note'))
      .toBe('No funding fee (exempt), so you borrow $400,000.00. There is no mortgage insurance, whatever the down payment.');
  });
});
