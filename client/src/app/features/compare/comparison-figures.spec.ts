import { aHousingCosts, aPayment, aProjectionYear, aPurchase, aResponse, aSavings, aSchedule } from '../../../testing/builders';
import { CashToClose } from '../../core/models/amortization.models';
import { cheapestHome, comparisonHeadline, figuresOf } from './comparison-figures';

describe('the figures a home is compared by', () => {
  const cash = (overrides: Partial<CashToClose> = {}) => ({
    downPayment: 50_000, closingCosts: 9_000, credits: 1_000, escrowDeposit: 1_500, homeownersInsurance: 2_400, total: 58_000, ...overrides,
  }) as CashToClose;

  it('reads the price, down payment, loan, rate and first payment from the results', () => {
    const f = figuresOf(aResponse({
      purchase: aPurchase({ homePrice: 415_000, downPayment: 37_350, downPaymentPercent: 9, loanAmount: 377_650 }),
      baseline: aSchedule({ monthlyPayment: 2_325.26, totalMonthlyPayment: 3_102.19, monthlyHousingCosts: aHousingCosts({ total: 776.93 }),
        payments: [aPayment(1, { annualInterestRate: 6.25 })] }),
    }));

    expect(f).toEqual(expect.objectContaining({
      homePrice: 415_000, downPayment: 37_350, downPaymentPercent: 9, loanAmount: 377_650, rate: 6.25,
      monthlyPayment: 3_102.19, principalAndInterest: 2_325.26, housingCosts: 776.93,
    }));
  });

  it("takes a buydown's first payment, the one actually paid at first", () => {
    const f = figuresOf(aResponse({
      baseline: aSchedule({ monthlyPayment: 2_325.26, totalMonthlyPayment: 3_102.19, monthlyHousingCosts: aHousingCosts({ total: 776.93 }) }),
      buydown: { years: [{ year: 1, annualInterestRate: 4.25, monthlyPayment: 1_857.82, subsidy: 467.44 }] } as never,
    }));

    expect(f.principalAndInterest).toBe(1_857.82);
    expect(f.monthlyPayment).toBeCloseTo(2_634.75, 2);
  });

  it('counts the first five years of what does not build equity: interest, housing costs, and closing costs', () => {
    // 60 payments of $400 interest (less a $50 subsidy) and $300 of housing costs: 60 × 650 = 39,000. At closing,
    // 9,000 of costs less 1,000 of credits, less the escrow deposit and the first year's insurance, which prepay
    // housing costs already counted month by month: 4,100.
    const payments = Array.from({ length: 72 }, (_, i) => aPayment(i + 1, { interest: 400, buydownSubsidy: 50, housingCosts: 300 }));
    const f = figuresOf(aResponse({ accelerated: aSchedule({ payments }), cashToClose: cash() }));

    expect(f.fiveYearCost).toBe(43_100);
    expect(f.cashToClose).toBe(58_000);
  });

  it('counts no closing costs when there is no cash to close (a loan already being paid)', () => {
    expect(figuresOf(aResponse({ cashToClose: null })).cashToClose).toBeNull();
  });

  it('reads the equity after five years: at the start of year 6, or the last year of a shorter projection', () => {
    const projection = [1, 2, 3, 4, 5, 6, 7].map((y) => aProjectionYear(y, { equity: y * 10_000 }));
    expect(figuresOf(aResponse({ projection })).equityAfterFiveYears).toBe(60_000);
    expect(figuresOf(aResponse({ projection: projection.slice(0, 3) })).equityAfterFiveYears).toBe(30_000);
  });

  it('reads when it is paid off, the interest paid, and when the mortgage insurance ends, if it has any', () => {
    const f = figuresOf(aResponse({
      accelerated: aSchedule({ interestYouPay: 355_964, mortgageInsuranceEndDate: '2032-07-01' }),
      savings: aSavings({ acceleratedPayoffDate: '2051-01-01' }),
    }));

    expect([f.paidOff, f.interest, f.insuranceEnds]).toEqual(['2051-01-01', 355_964, '2032-07-01']);
  });
});

describe('the comparison in one line', () => {
  const homeWith = (monthlyPayment: number, cashToClose: number | null, fiveYearCost: number) =>
    ({ monthlyPayment, cashToClose, fiveYearCost }) as ReturnType<typeof figuresOf>;

  it('says what the second home costs more or less each month, at closing, and over five years', () => {
    expect(comparisonHeadline(homeWith(3_102.19, 48_128.79, 120_000), homeWith(3_460.02, 56_210, 131_500)))
      .toBe('Home B costs $357.83 a month more, needs $8,081 more at closing, and costs $11,500 more over the first 5 years.');
    expect(comparisonHeadline(homeWith(3_460.02, 56_210, 131_500), homeWith(3_102.19, 48_128.79, 120_000)))
      .toBe('Home B costs $357.83 a month less, needs $8,081 less at closing, and costs $11,500 less over the first 5 years.');
  });

  it('says when a figure is the same, and leaves out closing for a loan already being paid', () => {
    expect(comparisonHeadline(homeWith(3_000, null, 100_000), homeWith(3_000, null, 100_000)))
      .toBe('Home B costs the same a month, and costs the same over the first 5 years.');
  });

  it('names the home it compares with Home A', () => {
    expect(comparisonHeadline(homeWith(3_000, null, 100_000), homeWith(3_100, null, 104_000), 'Home D'))
      .toBe('Home D costs $100.00 a month more, and costs $4,000 more over the first 5 years.');
  });
});

describe('the cheapest of several homes', () => {
  const costing = (fiveYearCost: number) => ({ fiveYearCost }) as ReturnType<typeof figuresOf>;

  it('names the home that costs the least over five years, and by how much it beats the next', () => {
    expect(cheapestHome([costing(120_000), costing(118_500.4), costing(111_250)]))
      .toBe('Home C costs the least over the first 5 years: $7,250 less than Home B, the next.');
    expect(cheapestHome([costing(100_000), costing(130_000), costing(110_000), costing(105_000)]))
      .toBe('Home A costs the least over the first 5 years: $5,000 less than Home D, the next.');
  });

  it('says when the two cheapest cost the same', () => {
    expect(cheapestHome([costing(120_000), costing(110_000), costing(110_000.2)]))
      .toBe('Home B and Home C cost the least over the first 5 years, the same.');
  });

  it('says when every home costs the same', () => {
    expect(cheapestHome([costing(110_000), costing(110_000), costing(110_000.4), costing(110_000)]))
      .toBe('All 4 homes cost the same over the first 5 years.');
  });
});
