import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aRefinanceOption, aRefinanceResponse } from '../../../../testing/builders';
import { fakeCharts } from '../../../../testing/fake-charts';
import { RefinanceResponse } from '../../../core/models/refinance.models';
import { RefinanceResultsComponent } from './refinance-results.component';

describe('RefinanceResultsComponent', () => {
  let fixture: ComponentFixture<RefinanceResultsComponent>;

  beforeEach(() => TestBed.configureTestingModule({ providers: [fakeCharts().provider] }));

  const render = (result: RefinanceResponse) => {
    fixture = TestBed.createComponent(RefinanceResultsComponent);
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();
  };
  const text = (testId: string) =>
    (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null)?.textContent?.replace(/\s+/g, ' ').trim();

  describe('the verdict', () => {
    it('says plainly when a lower payment still costs more overall', () => {
      render(aRefinanceResponse());

      expect(text('refi-verdict')).toContain('Refinancing costs $17,415 more');
      expect(text('refi-verdict')).toContain('The payment drops $321.69 a month, but the loan runs 5 yr longer.');
    });

    it('says how much a refinance saves when it does', () => {
      render(aRefinanceResponse({ lifetimeSavings: 42_000, monthsAdded: 0 }));

      expect(text('refi-verdict')).toContain('Refinancing saves $42,000');
    });
  });

  describe('the tiles', () => {
    it('shows the new payment against today\'s', () => {
      render(aRefinanceResponse());

      expect(text('refi-payment')).toContain('$1,798.65');
      expect(text('refi-payment')).toContain('$321.69 less than now');
    });

    it('shows a higher payment as more than now', () => {
      render(aRefinanceResponse({ monthlySavings: -50 }));

      expect(text('refi-payment')).toContain('$50.00 more than now');
    });

    it('shows when the refinance breaks even, or that it never does', () => {
      render(aRefinanceResponse());
      expect(text('refi-break-even')).toContain('Jan 2028');
      expect(text('refi-break-even')).toContain('after 25 payments');

      render(aRefinanceResponse({ breakEvenPaymentNumber: null, breakEvenDate: null }));
      expect(text('refi-break-even')).toContain('Never');
    });

    it('shows how much later (or sooner) the loan is paid off', () => {
      render(aRefinanceResponse());
      expect(text('refi-payoff')).toContain('Dec 2055');
      expect(text('refi-payoff')).toContain('5 yr later than now');

      render(aRefinanceResponse({ monthsAdded: -14 }));
      expect(text('refi-payoff')).toContain('1 yr 2 mo sooner than now');

      render(aRefinanceResponse({ monthsAdded: 0 }));
      expect(text('refi-payoff')).toContain('same as now');
    });

    it('compares total interest with what is left on the current loan', () => {
      render(aRefinanceResponse());

      expect(text('refi-interest')).toContain('$347,515');
      expect(text('refi-interest')).toContain('vs $336,100 left on your loan');
    });
  });

  describe('the clock restarting', () => {
    it('explains why a longer new loan costs more, using its first payment', () => {
      render(aRefinanceResponse());

      expect(text('refi-restart')).toContain('The clock restarts');
      expect(text('refi-restart')).toContain('$1,500 of the first $1,798.65 payment is interest');
    });

    it('is not shown when the new loan ends no later than the current one', () => {
      render(aRefinanceResponse({ monthsAdded: 0 }));

      expect(text('refi-restart')).toBeUndefined();
    });

    it('offers the way around it: keep paying today\'s amount', () => {
      render(aRefinanceResponse());

      expect(text('refi-keep-payment')).toContain('Keep paying $2,120.34 a month');
      expect(text('refi-keep-payment')).toContain('paid off Jul 2046, 4 yr 5 mo sooner than your current loan');
      expect(text('refi-keep-payment')).toContain('saving $107,590 overall');
    });

    it('has no keep-the-payment option when the new payment is not lower', () => {
      render(aRefinanceResponse({ keepingCurrentPayment: null, keepingCurrentPaymentLifetimeSavings: null }));

      expect(text('refi-keep-payment')).toBeUndefined();
    });
  });

  describe('the comparison table', () => {
    it('lines up every option, closing costs included in the total cost', () => {
      render(aRefinanceResponse());
      const headers = [...fixture.nativeElement.querySelectorAll('[data-testid="refi-table"] thead th')].map((th) => (th as HTMLElement).textContent!.trim());
      const totalCost = [...fixture.nativeElement.querySelectorAll('[data-testid="refi-total-cost"] td')].map((td) => (td as HTMLElement).textContent!.trim());

      expect(headers).toEqual(['', 'Keep current loan', 'Refinance', 'Refinance, keep payment']);
      expect(totalCost).toEqual(['$636,100', '$653,515', '$528,510']);
    });

    it('drops the keep-payment column when that option does not apply', () => {
      render(aRefinanceResponse({ keepingCurrentPayment: null, keepingCurrentPaymentLifetimeSavings: null, current: aRefinanceOption() }));
      const headers = [...fixture.nativeElement.querySelectorAll('[data-testid="refi-table"] thead th')].map((th) => (th as HTMLElement).textContent!.trim());

      expect(headers).toEqual(['', 'Keep current loan', 'Refinance']);
    });
  });
  it('shows nothing about rates when both are fixed', () => {
    render(aRefinanceResponse());
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="refi-rates"]')).toBeNull();
  });

  it("lists each loan's resets and the worst case when a rate adjusts", () => {
    const reset = { paymentNumber: 25, effectiveDate: '2028-01-01', previousRate: 7, newRate: 9, previousPayment: 2_120.34, newPayment: 2_496.08 };
    render(aRefinanceResponse({
      current: aRefinanceOption({ rateChanges: [reset] }),
      lifetimeSavings: 86_292.68,
      worstCaseLifetimeSavings: 239_046.91,
    }));
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="refi-rates"] li')!.textContent).toBe('Your loan resets from Jan 2028: 7% → 9%, $2,120.34 → $2,496.08 a month.');
    expect(root.querySelector('[data-testid="refi-worst-case"]')!.textContent!.trim()).toBe(
      'If rates rise as far as the caps allow, refinancing would save $239,047 over the life of the loan (on the path you expect, it saves $86,293).');
  });

  it('explains that a buydown on the new loan changes when you pay, not how much', () => {
    render(aRefinanceResponse({
      buydownCost: 6_655.08,
      newBuydown: {
        noteRate: 6, totalSubsidy: 6_655.08, paidBy: 'Borrower',
        years: [
          { year: 1, annualInterestRate: 4, monthlyPayment: 1_432.25, subsidy: 4_396.8 }, { year: 2, annualInterestRate: 5, monthlyPayment: 1_610.46, subsidy: 2_258.28 },
          { year: 3, annualInterestRate: 6, monthlyPayment: 1_798.65, subsidy: 0 },
        ],
      },
    }));
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="refi-buydown"]')!.textContent).toBe(
      'The 2-1 buydown costs $6,655 at closing (in the cash at closing) and pays it back as lower payments: '
      + '$1,432.25 in year 1, $1,610.46 in year 2, $1,798.65 from year 3. It changes when you pay, not how much.');
    expect(root.querySelector('[data-testid="refi-buydown-first-year"]')!.textContent).toBe('$1,432.25 in year 1, with the buydown');
    expect(Array.from(root.querySelectorAll('[data-testid="refi-table"] th'), (th) => th.textContent!.trim())).toContain('Closing costs + buydown');
  });

  describe('with PMI', () => {
    const withPmi = () => aRefinanceResponse({
      current: aRefinanceOption({ loanAmount: 300_000, monthlyPayment: 2_120.34, numberOfPayments: 300, totalPaid: 636_100.16, payoffDate: '2050-12-01',
        monthlyPmi: 120, totalPmi: 4_080, pmiEndDate: '2028-10-01' }),
      refinanced: aRefinanceOption({ loanAmount: 300_000, monthlyPayment: 1_798.65, numberOfPayments: 360, totalPaid: 647_515.44, payoffDate: '2055-12-01',
        monthlyPmi: 125, totalPmi: 8_000, pmiEndDate: '2031-04-01' }),
      monthlySavings: 316.69,
    });

    it('counts it in the new payment, and says until when', () => {
      render(withPmi());

      expect(text('refi-payment')).toContain('$1,923.65');
      expect(text('refi-new-pmi')).toBe('with $125.00 PMI, until Apr 2031');
    });

    it('shows each loan\'s PMI in the table, in the total cost, and in what the break-even counts', () => {
      render(withPmi());

      expect(text('refi-pmi')).toContain('$4,080 to Oct 2028');
      expect(text('refi-pmi')).toContain('$8,000 to Apr 2031');
      expect(text('refi-total-cost')).toContain('$640,180'); // $636,100.16 + $4,080
      expect(text('refi-break-even')).toContain('the interest and PMI saved cover the closing costs');
    });

    it('leaves PMI out where neither loan has any', () => {
      render(aRefinanceResponse());

      expect(text('refi-pmi')).toBeUndefined();
      expect(text('refi-new-pmi')).toBeUndefined();
      expect(text('refi-break-even')).toContain('the interest saved covers');
    });
  });
});
