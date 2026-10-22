import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aRefinanceOption, aRefinanceResponse } from '../../../../testing/builders';
import { HomeEquityComparison, RefinanceResponse } from '../../../core/models/refinance.models';
import { RefinanceResultsComponent } from './refinance-results.component';

describe('RefinanceResultsComponent', () => {
  let fixture: ComponentFixture<RefinanceResultsComponent>;

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

    it('shows the better move in the same verdict when asked: the payment kept, the extra going to principal', () => {
      render(aRefinanceResponse());
      expect(text('refi-verdict')).toContain('Refinancing costs $17,415 more');

      (fixture.nativeElement.querySelector('[data-testid="refi-keep-switch"] input') as HTMLInputElement).click();
      fixture.detectChanges();

      expect(text('refi-verdict')).toContain('Refinancing saves $107,590');
      expect(text('refi-verdict')).toContain('The payment stays at $2,120.34, and the extra $321.69 a month goes to principal');
      expect(text('refi-payment')).toContain('same as now');
      expect(text('refi-payoff')).toContain('Jul 2046');
      expect(text('refi-interest')).toContain('$222,510');
    });

    it('says how much a refinance saves when it does', () => {
      render(aRefinanceResponse({ lifetimeSavings: 42_000, monthsAdded: 0 }));

      expect(text('refi-verdict')).toContain('Refinancing saves $42,000');
    });
  });

  describe('a home-equity loan for the cash', () => {
    /** The reference scenario of the API's tests: $50,000 on a $300,000 loan, as a home-equity loan at 8% for 15 years, or a refinance to 6%. */
    const equity = (overrides: Partial<HomeEquityComparison> = {}): RefinanceResponse => aRefinanceResponse({
      cashOut: 50_000, netCash: 44_000,
      homeEquity: {
        amount: 50_000, annualInterestRate: 8, termInMonths: 180, yearsKept: 7, availableEquity: 100_000, combinedLoanToValuePercent: 70, exceedsLimit: false,
        keepAndBorrow: { monthlyPayment: 2_598.17, equityLoanPayment: 477.83, payments: 218_246.28, stillOwed: 293_803.71, upfrontCosts: 0, cost: 512_049.99 },
        cashOutRefinance: { monthlyPayment: 2_098.43, equityLoanPayment: 0, payments: 176_268.12, stillOwed: 313_737.59, upfrontCosts: 6_000, cost: 496_005.71 },
        savedByEquityLoan: -16_044.28,
        ...overrides,
      },
    });

    it('says which way costs less over the years kept, and by how much', () => {
      render(equity());
      expect(text('refi-equity-verdict')).toBe('Keeping your loan and borrowing $50,000 separately costs $16,044 more over 7 years than refinancing.');

      render(equity({ savedByEquityLoan: 4_321.5 }));
      expect(text('refi-equity-verdict')).toBe('Keeping your loan and borrowing $50,000 separately costs $4,322 less over 7 years than refinancing.');
    });

    it('says "1 year" for a single year', () => {
      render(equity({ yearsKept: 1 }));

      expect(text('refi-equity-verdict')).toContain('over 1 year than');
    });

    it('lays the two ways side by side: payment, what is paid, what is still owed, closing and the total', () => {
      render(equity());
      const rows = [...fixture.nativeElement.querySelectorAll('[data-testid="refi-equity-table"] tbody tr')]
        .map((tr) => [...(tr as HTMLElement).children].map((cell) => cell.textContent!.trim()).join(' | '));

      expect(rows).toEqual([
        'Monthly payment | $2,598.17 | $2,098.43',
        'Of which the home-equity loan | $477.83 | —',
        'Paid in the years kept | $218,246 | $176,268',
        'Still owed after | $293,804 | $313,738',
        'Paid at closing | $0 | $6,000',
        'Total cost | $512,050 | $496,006',
      ]);
    });

    it('says how much could be borrowed and where the loans together stand, within the limit', () => {
      render(equity());

      expect(text('refi-equity-limit')).toBe('You could borrow up to $100,000 against your home. With this cash, your loans would be 70% of its value, within the 80% lenders allow.');
    });

    it('warns when the loans together would be above the limit', () => {
      render(equity({ availableEquity: 20_000, combinedLoanToValuePercent: 87.5, exceedsLimit: true }));

      expect(text('refi-equity-limit')).toContain('above the 80% lenders allow, so this may not be offered.');
    });

    it('leaves the limit out without a home value, and the whole panel out when not asked for', () => {
      render(equity({ availableEquity: null, combinedLoanToValuePercent: null }));
      expect(text('refi-equity-limit')).toBeUndefined();

      render(aRefinanceResponse({ cashOut: 50_000 }));
      expect(text('refi-home-equity')).toBeUndefined();
    });
  });

  describe('what if the new rate were different', () => {
    it('prices the new loan at other rates, from the rate it was asked at', () => {
      fixture = TestBed.createComponent(RefinanceResultsComponent);
      fixture.componentRef.setInput('result', aRefinanceResponse());
      fixture.componentRef.setInput('newRate', 6);
      fixture.detectChanges();
      expect(text('rate-what-if')).toBeUndefined(); // one step away, in its own tab

      (fixture.nativeElement.querySelector('[data-testid="tab-rate"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(text('rate-what-if')).toContain('6%');
      expect(text('what-if-payment')).toContain('/mo');
    });

    it('opens on the options side by side, with the balances over time one tab away', () => {
      render(aRefinanceResponse());
      const tabs = () => [...fixture.nativeElement.querySelectorAll('[role="tab"]')].map((t: Element) => [t.textContent!.trim(), t.getAttribute('aria-selected')]);

      expect(tabs()).toEqual([['Side by side', 'true'], ['Over time', 'false']]);
      expect(text('refi-table')).toBeDefined();

      (fixture.nativeElement.querySelector('[data-testid="tab-time"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(text('refi-table')).toBeUndefined();
      expect(fixture.nativeElement.querySelector('app-refinance-chart')).not.toBeNull();
    });

    it('is left out until the rate is known, and for a loan whose rate changes', () => {
      render(aRefinanceResponse());
      expect(text('rate-what-if')).toBeUndefined();

      fixture = TestBed.createComponent(RefinanceResultsComponent);
      fixture.componentRef.setInput('result', aRefinanceResponse({ refinanced: aRefinanceOption({
        rateChanges: [{ paymentNumber: 61, effectiveDate: '2031-01-01', previousRate: 6, newRate: 8, previousPayment: 1_800, newPayment: 2_000 }],
      }) }));
      fixture.componentRef.setInput('newRate', 6);
      fixture.detectChanges();
      expect(text('rate-what-if')).toBeUndefined();
    });
  });

  describe('taking cash out', () => {
    /** $50,000 out on the reference refinance: a $350,000 loan, $44,000 in hand after the $6,000 closing costs. */
    const cashOut = (overrides: Partial<RefinanceResponse> = {}) => aRefinanceResponse({
      cashOut: 50_000, netCash: 44_000, lifetimeSavings: -75_331.68, breakEvenPaymentNumber: null, breakEvenDate: null,
      refinanced: aRefinanceOption({ loanAmount: 350_000, monthlyPayment: 2_098.43, numberOfPayments: 360, payoffDate: '2055-12-01' }),
      ...overrides,
    });

    it('says what the cash costs over the life of the loan, with the cash counted in hand', () => {
      render(cashOut());

      expect(text('refi-verdict')).toContain('Taking out $50,000 costs $75,332 more over the life of the loan');
    });

    it('shows the cash in hand after closing costs, where the break-even would be', () => {
      render(cashOut());

      expect(text('refi-cash')).toContain('$44,000');
      expect(text('refi-cash')).toContain('$50,000 out, less $6,000 paid at closing');
      expect(text('refi-break-even')).toBeUndefined();
    });

    it('says the cash arrives with closing costs financed too', () => {
      render(cashOut({ upfrontCosts: 0, netCash: 50_000 }));

      expect(text('refi-cash')).toContain('$50,000');
      expect(text('refi-cash')).toContain('nothing paid at closing');
    });

    it('warns when the new loan is above what a cash-out refinance allows', () => {
      render(cashOut({ newLoanToValuePercent: 87.5, exceedsCashOutLimit: true }));

      expect(text('refi-cash-limit')).toBe(
        "The new loan is 87.5% of the home's value. Lenders cap a cash-out refinance at 80%, so this one may not be offered.");
    });

    it('says how much of the value the new loan is, when it is within the limit', () => {
      render(cashOut({ newLoanToValuePercent: 70 }));

      expect(text('refi-cash-limit')).toBe("The new loan is 70% of the home's value, within the 80% a cash-out refinance allows.");
    });

    it('leaves all of it out when no cash is taken', () => {
      render(aRefinanceResponse());

      expect(text('refi-cash')).toBeUndefined();
      expect(text('refi-break-even')).toBeDefined();
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
      expect(text('refi-restart')).toContain("of the first payment's $1,798.65 in principal and interest, $1,500 is interest");
      expect(text('refi-restart')).toContain('That is how a lower rate and a lower payment can still cost more in the end.');
    });

    it('says what the restart costs when the refinance still saves', () => {
      render(aRefinanceResponse({ lifetimeSavings: 31_527, monthsAdded: 24 }));

      expect(text('refi-restart')).toContain('It is why the refinance saves less than the lower rate alone would.');
      expect(text('refi-restart')).not.toContain('still cost more');
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
      const headers = [...fixture.nativeElement.querySelectorAll('[data-testid="refi-table"] thead th, [data-testid="refi-table"] thead td')].map((th) => (th as HTMLElement).textContent!.trim());
      const totalCost = [...fixture.nativeElement.querySelectorAll('[data-testid="refi-total-cost"] td')].map((td) => (td as HTMLElement).textContent!.trim());

      expect(headers).toEqual(['', 'Keep current loan', 'Refinance', 'Refinance, keep payment']);
      expect(totalCost).toEqual(['$636,100', '$653,515', '$528,510']);
    });

    it('drops the keep-payment column when that option does not apply', () => {
      render(aRefinanceResponse({ keepingCurrentPayment: null, keepingCurrentPaymentLifetimeSavings: null, current: aRefinanceOption() }));
      const headers = [...fixture.nativeElement.querySelectorAll('[data-testid="refi-table"] thead th, [data-testid="refi-table"] thead td')].map((th) => (th as HTMLElement).textContent!.trim());

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
