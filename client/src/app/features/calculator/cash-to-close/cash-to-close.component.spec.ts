import { TestBed } from '@angular/core/testing';
import { CashToClose } from '../../../core/models/amortization.models';
import { CashToCloseComponent } from './cash-to-close.component';

describe('CashToCloseComponent', () => {
  /** $375,000 with $18,750 down at 6.5%: the API's answer for the form's example closing costs, with $3,000 of credits. */
  const typical: CashToClose = {
    downPayment: 18_750, loanCosts: 4_000, otherFees: 1_000,
    dailyInterest: 63.44, prepaidInterestDays: 15, prepaidInterest: 951.6,
    homeownersInsurance: 2_400, monthlyEscrow: 795.83, escrowMonths: 3, escrowDeposit: 2_387.49,
    buydownCost: 0, discountPoints: 0, upfrontMortgageFee: 0, closingCosts: 10_739.09, credits: 3_000, unusedCredits: 0, total: 26_489.09,
  };

  const render = (cash: CashToClose, program: 'Fha' | 'Va' | null = null) => {
    const fixture = TestBed.createComponent(CashToCloseComponent);
    fixture.componentRef.setInput('cash', cash);
    fixture.componentRef.setInput('program', program ? { type: program } : null);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    // Each row as "label | detail | amount", the detail (how the line was worked out) being under the label.
    const rows = () => Array.from(root.querySelectorAll('tbody tr'), (tr) => {
      const th = tr.querySelector('th')!;
      const detail = th.querySelector('.detail')?.textContent?.trim() ?? '';
      const label = th.textContent!.replace(detail, '').trim();
      return [label, detail, tr.querySelector('td')!.textContent!.trim()].filter(Boolean).join(' | ');
    });
    return { text, rows };
  };

  it('lists each line, with how prepaid interest and escrow are worked out, then the total', () => {
    const { text, rows } = render(typical);

    expect(rows()).toEqual([
      'Down payment | $18,750.00',
      'Loan costs | $4,000.00',
      'Other fees | $1,000.00',
      'Prepaid interest | 15 days at $63.44 | $951.60',
      'Homeowners insurance | the first year | $2,400.00',
      'Escrow deposit | 3 months at $795.83 | $2,387.49',
      'Credits | seller and lender | −$3,000.00',
    ]);
    expect(text('cash-to-close-total')).toBe('$26,489.09');
  });

  it('says in one line what closing adds to the down payment', () => {
    expect(render(typical).text('cash-to-close-intro')).toBe('Closing costs add $10,739 to the $18,750 down payment; credits take $3,000 off.');
  });

  it('leaves out lines that are zero, but always shows the down payment', () => {
    const { rows, text } = render({
      ...typical, downPayment: 0, loanCosts: 0, otherFees: 0, prepaidInterestDays: 0, prepaidInterest: 0, escrowMonths: 0, escrowDeposit: 0,
      credits: 0, closingCosts: 2_400, total: 2_400,
    });

    expect(rows()).toEqual(['Down payment | $0.00', 'Homeowners insurance | the first year | $2,400.00']);
    expect(text('cash-to-close-intro')).toBe('Closing costs add $2,400 to the $0 down payment.');
  });

  it('shows a buydown you pay for at closing', () => {
    expect(render({ ...typical, buydownCost: 4_436.76 }).rows()).toContain('Temporary buydown | you pay for it | $4,436.76');
  });

  it("shows an FHA or VA loan's upfront fee when it is paid at closing, by its name", () => {
    const fha = render({ ...typical, upfrontMortgageFee: 5_066.25 }, 'Fha').rows();
    const va = render({ ...typical, upfrontMortgageFee: 8_600 }, 'Va').rows();

    expect(fha).toContain('FHA upfront MIP | not added to the loan | $5,066.25');
    expect(va).toContain('VA funding fee | not added to the loan | $8,600.00');
  });

  it('shows discount points, paid at closing', () => {
    expect(render({ ...typical, discountPoints: 3_562.5 }).rows()).toContain('Discount points | $3,562.50');
  });

  it('says when credits are more than the closing costs, since the rest cannot pay the down payment', () => {
    const { text } = render({ ...typical, credits: 10_739.09, unusedCredits: 4_260.91, total: 18_750 });

    expect(text('unused-credits')).toBe('$4,260.91 of the credits goes unused: credits pay closing costs, never the down payment.');
  });

  it('says nothing about unused credits when there are none', () => {
    expect(render(typical).text('unused-credits')).toBeUndefined();
  });
});
