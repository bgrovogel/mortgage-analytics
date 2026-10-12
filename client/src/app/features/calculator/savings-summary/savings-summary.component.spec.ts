import { ComponentFixture, TestBed } from '@angular/core/testing';
import { aHousingCosts, aPayment, aResponse, aSavings, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse } from '../../../core/models/amortization.models';
import { SavingsSummaryComponent } from './savings-summary.component';

describe('SavingsSummaryComponent', () => {
  let fixture: ComponentFixture<SavingsSummaryComponent>;

  const render = (response: AmortizationResponse) => {
    fixture = TestBed.createComponent(SavingsSummaryComponent);
    fixture.componentRef.setInput('result', response);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  const text = (testId: string) =>
    (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null)?.textContent?.trim();

  it('shows the all-in monthly payment with principal and interest broken out', () => {
    render(aResponse({ baseline: aSchedule({ monthlyPayment: 1_199.1, totalMonthlyPayment: 1_711.6, monthlyHousingCosts: aHousingCosts({ localTax: 512.5 }) }) }));

    expect(text('total-monthly-payment')).toBe('$1,711.60');
    expect(text('monthly-payment')).toBe('$1,199.10');
    expect(text('housing-costs-label')).toBe('county/city tax');
  });

  it('names exactly the housing costs the payment includes', () => {
    render(aResponse({ baseline: aSchedule({ monthlyHousingCosts: aHousingCosts({ propertyTax: 595.83, homeownersInsurance: 200, mortgageInsurance: 148.44, hoaDues: 50 }) }) }));
    expect(text('housing-costs-label')).toBe('property tax, insurance, PMI & HOA');

    render(aResponse({ baseline: aSchedule({ monthlyHousingCosts: aHousingCosts({ schoolTax: 100, localTax: 90, mudTax: 80, pidAssessment: 100, homeownersInsurance: 200 }) }) }));
    expect(text('housing-costs-label')).toBe('property taxes, PID & insurance');
  });

  it('labels the payment as the required payment', () => {
    render(aResponse());

    expect(fixture.nativeElement.textContent).toContain('Required monthly payment');
  });

  it('shows what the first payment comes to with the extra principal', () => {
    render(aResponse({ accelerated: aSchedule({ payments: [aPayment(1, { extraPrincipal: 200, totalOutlay: 3_655.39 })] }) }));

    expect(text('with-extra')).toBe('+ $200 extra = $3,655.39');
  });

  it('omits the extra line when nothing extra is paid', () => {
    render(aResponse());

    expect(text('with-extra')).toBeUndefined();
  });

  /** A response where extra payments saved something: $79,801 of interest and 108 payments. */
  const withExtras = () => aResponse({
    baseline: aSchedule({ totalInterest: 231_677.04 }),
    accelerated: aSchedule({ totalInterest: 151_876.18 }),
    savings: aSavings({ interestSaved: 79_800.86, netSavings: 79_800.86, paymentsSaved: 108, totalExtraPrincipal: 50_400 }),
  });

  it('makes net savings the headline figure when extra payments save something', () => {
    render(withExtras());

    expect(fixture.nativeElement.querySelector('[data-testid="net-savings"]').closest('.tile').classList).toContain('hero');
  });

  it('shows the total interest with extra payments, and what it would have been', () => {
    render(withExtras());

    expect(text('total-interest')).toBe('$151,876');
    expect(text('total-interest-detail')).toBe('instead of $231,677');
  });

  it('without extra payments, makes total interest the headline instead of a $0 saving', () => {
    render(aResponse({ baseline: aSchedule({ totalInterest: 231_677.04, numberOfPayments: 360 }) }));

    expect(text('net-savings')).toBeUndefined();
    expect(text('total-interest')).toBe('$231,677');
    expect(fixture.nativeElement.querySelector('[data-testid="total-interest"]').closest('.tile').classList).toContain('hero');
    expect(text('total-interest-detail')).toBe('Add an extra payment to see how much you could save.');
  });

  describe('with a buydown', () => {
    const twoOne = (paidBy: 'Seller' | 'Borrower') => ({
      noteRate: 6.5,
      years: [
        { year: 1, annualInterestRate: 4.5, monthlyPayment: 1_805.07 },
        { year: 2, annualInterestRate: 5.5, monthlyPayment: 2_022.75 },
        { year: 3, annualInterestRate: 6.5, monthlyPayment: 2_251.74 },
      ],
      totalSubsidy: 8_107.92,
      paidBy,
    });

    it('the seller pays: says how much of the interest its subsidy pays, and what you pay', () => {
      render(aResponse({
        buydown: twoOne('Seller'),
        baseline: aSchedule({ totalInterest: 454_378.85, buydownSubsidy: 8_107.92, interestYouPay: 446_270.93 }),
      }));

      expect(text('total-interest')).toBe('$454,379');
      expect(text('interest-you-pay')).toBe("The seller's buydown pays $8,108 of it, so you pay $446,271.");
    });

    it('with extra payments, says it of the interest with them', () => {
      render(aResponse({
        buydown: twoOne('Seller'),
        baseline: aSchedule({ totalInterest: 231_677.04 }),
        accelerated: aSchedule({ totalInterest: 151_876.18, buydownSubsidy: 4_436.76, interestYouPay: 147_439.42 }),
        savings: aSavings({ interestSaved: 79_800.86, netSavings: 79_800.86, paymentsSaved: 108 }),
      }));

      expect(text('interest-you-pay')).toBe("The seller's buydown pays $4,437 of it, so you pay $147,439.");
    });

    it('you pay for it: says it lowers the early payments, not the interest', () => {
      render(aResponse({
        buydown: twoOne('Borrower'),
        baseline: aSchedule({ totalInterest: 454_378.85, buydownSubsidy: 8_107.92, interestYouPay: 454_378.85 }),
      }));

      expect(text('interest-you-pay')).toBe('Your buydown, paid for at closing, lowers the early payments, not the interest.');
    });

    it('says nothing about it without one', () => {
      render(aResponse());

      expect(text('interest-you-pay')).toBeUndefined();
    });
  });

  it('without extra payments, hides the time-saved tile rather than showing 0 months', () => {
    render(aResponse());

    expect(text('time-saved')).toBeUndefined();
  });

  it('shows the extra from the first payment that has one, e.g. the next payment on a loan already being paid', () => {
    const accelerated = aSchedule({ payments: [aPayment(1), aPayment(2, { extraPrincipal: 200, totalOutlay: 1_399.1 })] });
    const component = render(aResponse({ accelerated, savings: aSavings({ netSavings: 1 }) }));

    expect(component.withExtra()).toEqual({ amount: 200, total: 1_399.1 });
  });

  it('with a buydown, shows the reduced payment due in year 1', () => {
    render(aResponse({
      buydown: { noteRate: 6, years: [{ year: 1, annualInterestRate: 4, monthlyPayment: 954.83 }, { year: 2, annualInterestRate: 6, monthlyPayment: 1_199.1 }], totalSubsidy: 2_930.04, paidBy: 'Seller' },
    }));

    expect(text('total-monthly-payment')).toBe('$954.83');
    expect(text('monthly-payment')).toBe('$954.83');
    expect(text('buydown-first-year')).toBe('In year 1, with the buydown');
  });

  it('omits the taxes line when there are no housing costs', () => {
    render(aResponse());

    expect(text('housing-costs-label')).toBeUndefined();
  });

  it('does not repeat the headline when the savings are all interest', () => {
    const component = render(withExtras());

    expect(component.savingsDetail()).toBeNull();
    expect(text('savings-detail')).toBeUndefined();
    expect(text('net-savings')).toBe('$79,801');
    expect(fixture.nativeElement.querySelector('.tile.hero').textContent.replace(/\s+/g, ' ')).toContain('Total interest $151,876 instead of $231,677');
  });

  it('says when it is paid off and how much sooner in one tile, not two', () => {
    render(aResponse({ savings: aSavings({ paymentsSaved: 73, netSavings: 1, originalPayoffDate: '2056-10-01', acceleratedPayoffDate: '2050-09-01' }) }));

    expect(text('payoff-date')).toBe('Sep 2050');
    expect(fixture.nativeElement.querySelector('[data-testid="payoff-date"]').closest('.tile').textContent).toContain('6 yr 1 mo sooner, instead of Oct 2056');
    expect(fixture.nativeElement.querySelectorAll('.tile')).toHaveLength(3); // the headline, the payment, and when it is paid off
  });

  it('itemizes PMI saved and recast fees', () => {
    const component = render(aResponse({ savings: aSavings({ interestSaved: 10_000, mortgageInsuranceSaved: 6_531.36, recastFees: 250 }) }));

    expect(component.savingsDetail()).toBe('$10,000 interest + $6,531 PMI − $250 fees');
  });

  it('formats payments saved as years and months', () => {
    const component = render(aResponse({ savings: aSavings({ paymentsSaved: 73, netSavings: 1 }) }));

    expect(component.timeSaved()).toBe('6 yr 1 mo');
    expect(text('time-saved')).toBe('6 yr 1 mo');
  });

  it('shows the original payoff date only when it moved', () => {
    render(aResponse({ savings: aSavings({ paymentsSaved: 108, originalPayoffDate: '2055-12-01', acceleratedPayoffDate: '2046-12-01' }) }));

    expect(text('payoff-date')).toBe('Dec 2046');
    expect(fixture.nativeElement.textContent).toContain('instead of Dec 2055');
  });

  it('hides the PMI tile when there is no PMI', () => {
    render(aResponse());

    expect(text('pmi-end')).toBeUndefined();
  });

  it('shows when PMI ends, and the original end date when extra payments moved it', () => {
    render(aResponse({
      baseline: aSchedule({ mortgageInsuranceEndDate: '2037-03-01' }),
      accelerated: aSchedule({ mortgageInsuranceEndDate: '2031-09-01' }),
    }));

    expect(text('pmi-end')).toBe('Sep 2031');
    expect(fixture.nativeElement.textContent).toContain('instead of Mar 2037');
  });

  it("names an FHA loan's mortgage insurance MIP", () => {
    const component = render(aResponse({
      program: { type: 'Fha', upfrontFeePercent: 1.75, upfrontFee: 5_066.25, upfrontFeeFinanced: true, loanAmount: 294_566.25, annualMipPercent: 0.55, mipPayments: 360 },
      baseline: aSchedule({ mortgageInsuranceEndDate: '2056-10-01', monthlyHousingCosts: aHousingCosts({ mortgageInsurance: 134.33 }) }),
      accelerated: aSchedule({ mortgageInsuranceEndDate: '2049-02-01' }),
      savings: aSavings({ interestSaved: 10_000, mortgageInsuranceSaved: 4_000, netSavings: 14_000, paymentsSaved: 90 }),
    }));

    expect(fixture.nativeElement.querySelector('[data-testid="pmi-end"]').previousElementSibling.textContent.trim()).toBe('MIP ends');
    expect(text('housing-costs-label')).toBe('MIP');
    expect(component.savingsDetail()).toBe('$10,000 interest + $4,000 MIP');
  });

  it('shows the down payment instead when the PMI end date did not move', () => {
    render(aResponse({
      baseline: aSchedule({ mortgageInsuranceEndDate: '2037-03-01' }),
      accelerated: aSchedule({ mortgageInsuranceEndDate: '2037-03-01' }),
    }));

    expect(fixture.nativeElement.textContent).toContain('20% down');
  });

  it('lists each recast with the old and new payment and the fee', () => {
    render(aResponse({
      accelerated: aSchedule({
        recasts: [
          { afterPaymentNumber: 12, effectiveDate: '2027-01-01', previousPayment: 1_199.1, newPayment: 895.6, fee: 250 },
          { afterPaymentNumber: 24, effectiveDate: '2028-01-01', previousPayment: 895.6, newPayment: 700, fee: 0 },
        ],
      }),
    }));

    const recasts = text('recasts');
    expect(recasts).toContain('Recast after payment 12');
    expect(recasts).toContain('from $1,199.10 to $895.60');
    expect(recasts).toContain('($250 fee)');
    expect(recasts?.match(/fee/g)).toHaveLength(1);
  });
});
