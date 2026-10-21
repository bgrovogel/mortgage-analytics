import { aResponse } from '../../../../testing/builders';
import { Cell } from '../../../core/files/xlsx';
import { AmortizationRequest, AmortizationResponse } from '../../../core/models/amortization.models';
import { calculationWorkbook } from './calculation-workbook';

describe('calculationWorkbook', () => {
  const value = (cell: Cell | string | number | null | undefined) => (cell !== null && typeof cell === 'object' ? cell.value : cell);
  const rowsOf = (response: AmortizationResponse, request: AmortizationRequest | null = null) =>
    Object.fromEntries(calculationWorkbook(response, request).map((s) => [s.name, s.rows.map((r) => r.map(value))]));
  const summaryOf = (response: AmortizationResponse, request: AmortizationRequest | null = null) =>
    Object.fromEntries(rowsOf(response, request)['Summary'].filter((r) => r[0] && r[1] !== undefined && r[1] !== '').map((r) => [r[0], r[1]]));

  it('has a summary, the costs year by year, and the payments', () => {
    const sheets = calculationWorkbook(aResponse(), null);

    expect(sheets.map((s) => s.name)).toEqual(['Summary', 'Year by year', 'Payments']);
  });

  it('adds the plan with extra payments as a sheet of its own, and names the two apart, when there are extra payments', () => {
    const response = aResponse({ savings: { ...aResponse().savings, paymentsSaved: 24, totalExtraPrincipal: 20_000, interestSaved: 31_000, netSavings: 30_750 } });

    expect(calculationWorkbook(response, null).map((s) => s.name)).toEqual(['Summary', 'Year by year', 'Payments, standard', 'Payments, with extras']);
    expect(summaryOf(response)['Interest saved']).toBe(31_000);
    expect(summaryOf(response)['Payments saved']).toBe(24);
  });

  it('sums up the purchase, the month and the loan in numbers a spreadsheet can use', () => {
    const response = aResponse();
    const summary = summaryOf(response, { annualInterestRate: 6.5, termInMonths: 360 } as AmortizationRequest);

    expect(summary).toMatchObject({
      'Home price': response.purchase.homePrice,
      'Down payment': response.purchase.downPayment,
      'Loan amount': response.purchase.loanAmount,
      'Interest rate': 6.5,
      'Term, in years': 30,
      'Principal and interest': response.baseline.monthlyPayment,
      'Total, the first month': response.baseline.totalMonthlyPayment,
      Interest: response.baseline.totalInterest,
    });
  });

  it('rounds money to the cent, so a sum of cents has no floating-point tail', () => {
    const response = aResponse({ baseline: { ...aResponse().baseline, totalPaid: 1_000_000.1, totalHousingCosts: { ...aResponse().baseline.totalHousingCosts, total: 79_248.72 } } });

    expect(summaryOf(response)['Everything paid, with housing costs']).toBe(1_079_248.82);
  });

  it('leaves out the rate and term when the request is not known, and says when there is no PMI', () => {
    const summary = summaryOf(aResponse({ baseline: { ...aResponse().baseline, mortgageInsuranceEndDate: null } }));

    expect(summary['Interest rate']).toBeUndefined();
    expect(summary['PMI ends on']).toBe('No PMI');
  });

  it('adds the APR and the cash to close when the calculation has them', () => {
    const response = aResponse({ annualPercentageRate: 6.687, cashToClose: { total: 48_128.79 } as AmortizationResponse['cashToClose'] });

    expect(summaryOf(response)).toMatchObject({ APR: 6.687, 'Cash to close': 48_128.79 });
    expect(summaryOf(aResponse())['APR']).toBeUndefined();
  });

  it('writes a row for each loan year, the taxes added together, and each payment', () => {
    const response = aResponse();
    const sheets = rowsOf(response);

    expect(sheets['Year by year'][0]).toEqual(['Year', 'Starts', 'Home value', 'Taxed value', 'Property taxes', 'PID', 'Insurance', 'HOA dues', 'PMI', 'Housing costs', 'Owed at start', 'Equity']);
    expect(sheets['Year by year']).toHaveLength(1 + response.projection.length);
    const first = response.projection[0];
    expect(sheets['Year by year'][1][4]).toBe(first.costs.propertyTax + first.costs.schoolTax + first.costs.localTax + first.costs.mudTax);
    expect(sheets['Payments'][0]).toEqual(['#', 'Due', 'Payment', 'Principal', 'Interest', 'Extra principal', 'Housing costs', 'You pay', 'Owed after', 'Rate']);
    expect(sheets['Payments']).toHaveLength(1 + response.baseline.payments.length);
  });

  it('shows money as money, rates as percentages and dates as dates', () => {
    const [summary, years, payments] = calculationWorkbook(aResponse(), null);

    const styleOf = (rows: typeof summary.rows, r: number, c: number) => (rows[r][c] as Cell).style;
    expect(styleOf(summary.rows, 3, 1)).toBe('money');
    expect(styleOf(summary.rows, 5, 1)).toBe('percent');
    expect(styleOf(years.rows, 1, 1)).toBe('date');
    expect(styleOf(payments.rows, 1, 2)).toBe('money');
    expect(years.freezeHeader && payments.freezeHeader).toBe(true);
  });
});
