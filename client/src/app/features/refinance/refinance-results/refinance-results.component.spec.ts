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
});
