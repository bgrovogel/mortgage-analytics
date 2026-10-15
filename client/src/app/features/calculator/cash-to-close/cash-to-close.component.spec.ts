import { TestBed } from '@angular/core/testing';
import { CashToClose } from '../../../core/models/amortization.models';
import { CashToCloseComponent } from './cash-to-close.component';

describe('CashToCloseComponent', () => {
  /**
   * $375,000 with $18,750 down at 6.5%: the API's answer for the form's example closing costs, with $3,000 of the
   * seller's credits. On a conventional loan with 5% down, the seller may pay up to 3%, $11,250.
   */
  const typical: CashToClose = {
    downPayment: 18_750, loanCosts: 4_000, otherFees: 1_000,
    dailyInterest: 63.44, prepaidInterestDays: 15, prepaidInterest: 951.6,
    homeownersInsurance: 2_400, monthlyEscrow: 795.83, escrowMonths: 3, escrowDeposit: 2_387.49,
    buydownCost: 0, discountPoints: 0, upfrontMortgageFee: 0, closingCosts: 10_739.09,
    sellerCredits: 3_000, lenderCredits: 0, credits: 3_000, unusedCredits: 0, total: 26_489.09,
    concessions: {
      limitPercent: 3, limit: 11_250, sellerBuydown: 0, total: 3_000, overLimit: 0, normalClosingCostsExcluded: false,
      nextTier: { downPayment: 37_500, limitPercent: 6, limit: 22_500 },
    },
  };
  const concessions = (overrides: Partial<CashToClose['concessions']>) => ({ ...typical, concessions: { ...typical.concessions, ...overrides } });

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
      'Seller credits | −$3,000.00',
    ]);
    expect(text('cash-to-close-total')).toBe('$26,489.09');
  });

  it('says in one line what closing adds to the down payment', () => {
    expect(render(typical).text('cash-to-close-intro')).toBe('Closing costs add $10,739 to the $18,750 down payment; credits take $3,000 off.');
  });

  it('leaves out lines that are zero, but always shows the down payment', () => {
    const { rows, text } = render({
      ...typical, downPayment: 0, loanCosts: 0, otherFees: 0, prepaidInterestDays: 0, prepaidInterest: 0, escrowMonths: 0, escrowDeposit: 0,
      sellerCredits: 0, credits: 0, closingCosts: 2_400, total: 2_400,
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

  it("shows the lender's credits apart from the seller's", () => {
    expect(render({ ...typical, lenderCredits: 1_000, credits: 4_000, total: 25_489.09 }).rows()).toEqual(expect.arrayContaining([
      'Seller credits | −$3,000.00',
      'Lender credits | −$1,000.00',
    ]));
  });

  describe('what the seller or builder may pay', () => {
    it('gives the limit, why it is that, and what they pay of it', () => {
      expect(render(typical).text('concession-limit')).toBe(
        'A seller or builder may pay up to $11,250 of your costs: 3% of the price, with less than 10% down. Here they pay $3,000.');
    });

    it('names each conventional tier by the down payment', () => {
      expect(render(concessions({ limitPercent: 6, limit: 22_500 })).text('concession-limit')).toContain('6% of the price, with 10% to 25% down.');
      expect(render(concessions({ limitPercent: 9, limit: 33_750, nextTier: null })).text('concession-limit'))
        .toContain('9% of the price, with 25% or more down.');
      expect(render(concessions({ limitPercent: 2, limit: 7_500, nextTier: null })).text('concession-limit'))
        .toContain('2% of the price, for an investment property.');
    });

    it("names FHA's and VA's, VA's leaving out the normal closing costs", () => {
      expect(render(concessions({ limitPercent: 6, limit: 22_500, nextTier: null }), 'Fha').text('concession-limit'))
        .toContain('6% of the price on an FHA loan.');
      expect(render(concessions({ limitPercent: 4, limit: 15_000, nextTier: null, normalClosingCostsExcluded: true }), 'Va').text('concession-limit'))
        .toContain('4% of the price on a VA loan, besides the normal closing costs and points.');
    });

    it('counts a buydown they pay for', () => {
      expect(render(concessions({ sellerBuydown: 5_000, total: 8_000 })).text('concession-limit')).toContain('Here they pay $8,000, with the buydown.');
    });

    it('says nothing of what they pay when they pay nothing', () => {
      expect(render(concessions({ total: 0 })).text('concession-limit')).toBe(
        'A seller or builder may pay up to $11,250 of your costs: 3% of the price, with less than 10% down.');
    });

    it('says how much more down raises the limit', () => {
      expect(render(typical).text('concession-next')).toBe('With $37,500 down (10%), it would be 6%: $22,500.');
      expect(render(concessions({ limitPercent: 6, limit: 22_500, nextTier: { downPayment: 93_750, limitPercent: 9, limit: 33_750 } }))
        .text('concession-next')).toBe('With $93,750 down (25%), it would be 9%: $33,750.');
      expect(render(concessions({ nextTier: null })).text('concession-next')).toBeUndefined();
    });

    it('warns when they offer more than the limit, which the lender takes off the credits', () => {
      const { text, rows } = render({ ...concessions({ sellerBuydown: 9_000, total: 12_000, overLimit: 750 }), sellerCredits: 2_250, credits: 2_250 });

      expect(text('concessions-over')).toBe(
        "That is $750 over the limit, which can't pay your costs: ask for it off the price instead.");
      expect(rows()).toContain('Seller credits | up to the limit | −$2,250.00');
    });

    it('says nothing of the limit being passed when it is not', () => {
      expect(render(typical).text('concessions-over')).toBeUndefined();
    });
  });
});
