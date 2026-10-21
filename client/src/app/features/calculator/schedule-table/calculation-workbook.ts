import { Cell, Sheet } from '../../../core/files/xlsx';
import { AmortizationRequest, AmortizationResponse, Payment } from '../../../core/models/amortization.models';

const heading = (text: string): Cell => ({ value: text, style: 'heading' });
const label = (text: string): Cell => ({ value: text, style: 'bold' });
/** Money to the cent: a sum of cents carries a floating-point tail (1079248.8199999998) that has no place in a spreadsheet. */
const cents = (value: number) => Math.round(value * 100) / 100;
const money = (value: number): Cell => ({ value: cents(value), style: 'money' });
const percent = (value: number): Cell => ({ value, style: 'percent' });
const date = (value: string): Cell => ({ value, style: 'date' });

/** The calculation in a few lines, a heading at a time: the purchase, a month, the loan, and what extra payments and closing add. */
function summary(result: AmortizationResponse, request: AmortizationRequest | null): Sheet {
  const { purchase, baseline, savings } = result;
  const extras = savings.paymentsSaved > 0 || savings.totalExtraPrincipal > 0;
  const rows: (readonly (Cell | string | number | null)[])[] = [
    [{ value: 'Mortgage Analytics: the calculation', style: 'bold' }],
    [],
    [heading('The purchase'), heading('')],
    [label('Home price'), money(purchase.homePrice)],
    [label('Down payment'), money(purchase.downPayment)],
    [label('Down payment, as a share of the price'), percent(purchase.downPaymentPercent)],
    [label('Loan amount'), money(purchase.loanAmount)],
    ...(request ? [[label('Interest rate'), percent(request.annualInterestRate)], [label('Term, in years'), { value: request.termInMonths / 12, style: 'integer' as const }]] : []),
    [],
    [heading('Each month'), heading('')],
    [label('Principal and interest'), money(baseline.monthlyPayment)],
    [label('Taxes, insurance, dues and PMI'), money(baseline.monthlyHousingCosts.total)],
    [label('Total, the first month'), { value: cents(baseline.totalMonthlyPayment), style: 'moneyBold' }],
    [],
    [heading('Over the loan'), heading('')],
    [label('Interest'), money(baseline.totalInterest)],
    [label('Everything paid, with housing costs'), money(baseline.totalPaid + baseline.totalHousingCosts.total)],
    [label('Paid off on'), date(baseline.payoffDate)],
    [label('PMI ends on'), baseline.mortgageInsuranceEndDate ? date(baseline.mortgageInsuranceEndDate) : 'No PMI'],
  ];

  if (extras) {
    rows.push([], [heading('With extra payments'), heading('')],
      [label('Paid off on'), date(savings.acceleratedPayoffDate)],
      [label('Payments saved'), { value: savings.paymentsSaved, style: 'integer' }],
      [label('Interest saved'), money(savings.interestSaved)],
      [label('Net savings, after any recast fees'), money(savings.netSavings)]);
  }

  const extra: (readonly (Cell | string | number | null)[])[] = [];
  if (result.annualPercentageRate != null) extra.push([label('APR'), percent(result.annualPercentageRate)]);
  if (result.cashToClose) extra.push([label('Cash to close'), money(result.cashToClose.total)]);
  if (extra.length > 0) rows.push([], [heading('Costs of the loan'), heading('')], ...extra);

  rows.push([], ['The figures are as calculated by Mortgage Analytics for the numbers given. They are an estimate, not a loan offer.']);
  return { name: 'Summary', rows, widths: [42, 18] };
}

/** One row a year of the home's costs and what is owed on it, from the standard schedule's projection. */
function years(result: AmortizationResponse): Sheet {
  const head = ['Year', 'Starts', 'Home value', 'Taxed value', 'Property taxes', 'PID', 'Insurance', 'HOA dues', 'PMI', 'Housing costs', 'Owed at start', 'Equity'].map(heading);
  const rows = result.projection.map((y) => [
    { value: y.year, style: 'integer' as const },
    date(y.startDate),
    money(y.marketValue),
    money(y.assessedValue),
    money(y.costs.propertyTax + y.costs.schoolTax + y.costs.localTax + y.costs.mudTax),
    money(y.costs.pidAssessment),
    money(y.costs.homeownersInsurance),
    money(y.costs.hoaDues),
    money(y.costs.mortgageInsurance),
    money(y.costs.total),
    money(y.loanBalance),
    money(y.equity),
  ]);
  return { name: 'Year by year', rows: [head, ...rows], widths: [7, 12, 15, 15, 15, 12, 12, 12, 12, 15, 15, 15], freezeHeader: true };
}

/** One row a payment: what it pays toward the loan and the home's costs, and what is still owed. */
function payments(name: string, rows: readonly Payment[]): Sheet {
  const head = ['#', 'Due', 'Payment', 'Principal', 'Interest', 'Extra principal', 'Housing costs', 'You pay', 'Owed after', 'Rate'].map(heading);
  const body = rows.map((p) => [
    { value: p.paymentNumber, style: 'integer' as const },
    date(p.dueDate),
    money(p.scheduledPayment),
    money(p.principal),
    money(p.interest),
    money(p.extraPrincipal),
    money(p.housingCosts),
    money(p.totalOutlay),
    money(p.remainingBalance),
    percent(p.annualInterestRate),
  ]);
  return { name, rows: [head, ...body], widths: [7, 12, 13, 13, 13, 15, 15, 13, 15, 8], freezeHeader: true };
}

/**
 * The whole calculation as the sheets of a workbook: a summary, the costs year by year, and every payment on the standard
 * schedule, and on the plan with extra payments too when there are any. The cells are numbers, money and dates, so Excel can
 * add them up, chart them and sort them.
 */
export function calculationWorkbook(result: AmortizationResponse, request: AmortizationRequest | null): Sheet[] {
  const { baseline, accelerated, savings } = result;
  const extras = savings.paymentsSaved > 0 || savings.totalExtraPrincipal > 0;
  return [
    summary(result, request),
    years(result),
    payments(extras ? 'Payments, standard' : 'Payments', baseline.payments),
    ...(extras ? [payments('Payments, with extras', accelerated.payments)] : []),
  ];
}
