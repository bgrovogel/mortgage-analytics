import { aPayment, aResponse, aSchedule } from '../../../../testing/builders';
import { AmortizationResponse, BuydownSummary } from '../../../core/models/amortization.models';
import { buydownYears } from './buydown-years';

describe('buydownYears', () => {
  /** A 2-1 on $356,250 at 5.99%, whose taxes, insurance and PMI rise each year. */
  const twoOne: BuydownSummary = {
    noteRate: 5.99,
    years: [
      { year: 1, annualInterestRate: 3.99, monthlyPayment: 1_698.74, subsidy: 5_218.44 },
      { year: 2, annualInterestRate: 4.99, monthlyPayment: 1_910.25, subsidy: 2_680.32 },
      { year: 3, annualInterestRate: 5.99, monthlyPayment: 2_133.61, subsidy: 0 },
    ],
    totalSubsidy: 7_898.76, paidBy: 'Seller',
  };
  const housingInYear = [994.27, 1_010.5, 1_027];
  const withHousing = (): AmortizationResponse => aResponse({
    buydown: twoOne,
    baseline: aSchedule({
      payments: Array.from({ length: 36 }, (_, i) => aPayment(i + 1, { housingCosts: housingInYear[Math.floor(i / 12)] })),
    }),
  });

  it("gives each year's rate, its principal and interest, and the whole payment with that year's housing costs", () => {
    expect(buydownYears(withHousing())!.map((y) => [y.label, y.rate, y.loanPayment, y.monthlyTotal])).toEqual([
      ['Year 1', 3.99, 1_698.74, 2_693.01],
      ['Year 2', 4.99, 1_910.25, 2_920.75],
      ['From year 3', 5.99, 2_133.61, 3_160.61],
    ]);
  });

  it('says what the buydown pays each month and in each year, and nothing once the loan is at its note rate', () => {
    expect(buydownYears(withHousing())!.map((y) => [y.monthlySubsidy, y.subsidy])).toEqual([[434.87, 5_218.44], [223.36, 2_680.32], [0, 0]]);
  });

  it('uses the first payment\'s housing costs for a year the schedule does not reach', () => {
    const short = aResponse({
      buydown: twoOne,
      baseline: aSchedule({ monthlyHousingCosts: { ...aSchedule().monthlyHousingCosts, total: 500 }, payments: [aPayment(1, { housingCosts: 500 })] }),
    });

    expect(buydownYears(short)!.map((y) => y.monthlyTotal)).toEqual([2_198.74, 2_410.25, 2_633.61]);
  });

  it('is null without a buydown', () => {
    expect(buydownYears(aResponse())).toBeNull();
  });
});
