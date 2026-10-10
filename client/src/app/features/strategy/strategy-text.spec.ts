import { aStrategyComparison, aStrategyProjection } from '../../../testing/builders';
import { StrategyComparison } from '../../core/models/strategy.models';
import { crossover, facts, recommendation, scenarioLabel } from './strategy-text';

describe('strategy text', () => {
  const withRates = (rates: Partial<StrategyComparison['rates']>, rest: Partial<StrategyComparison> = {}) => {
    const base = aStrategyComparison();
    return aStrategyComparison({ ...rest, rates: { ...base.rates, ...rates } });
  };

  describe('recommendation', () => {
    it('names the winner, its lead, and the risk-adjusted return it rests on', () => {
      const r = recommendation(aStrategyComparison());

      expect(r.headline).toBe('Invest the difference');
      expect(r.detail).toBe('$59,433 more than Hybrid after 30 years (+1.6%), counting on 8% a year: your 10% expected return minus 2 points for risk.');
    });

    it('warns, with the amount, when a lost decade would reverse it', () => {
      const r = recommendation(aStrategyComparison());

      expect(r.reversible).toBe(true);
      // 3,187,295.65 − 3,145,932.42
      expect(r.downside).toBe('Not guaranteed: if the next ten years are a lost decade (-1% a year for ten years, like 2000–2009), '
        + 'Debt free ASAP comes out ahead by $41,363.');
    });

    it('reassures when a lost decade would not change it', () => {
      const r = recommendation(aStrategyComparison({ badDecadeWinner: 'InvestTheDifference' }));

      expect(r.reversible).toBe(false);
      expect(r.downside).toContain('it still comes out ahead');
    });

    it('explains a tie, and an aggressive profile that counts on the full return', () => {
      const r = recommendation(withRates({ riskMargin: 0, riskAdjustedReturn: 10 }, { lead: 0, recommended: 'PayOffFirst', runnerUp: 'Hybrid' }));

      expect(r.detail).toBe('It ties with Hybrid after 30 years, counting on your full 10% expected return; paying down debt carries no market risk, so it takes the tie.');
    });

    it('leaves out the percentage when the runner-up is not worth anything', () => {
      expect(recommendation(aStrategyComparison({ leadPercent: null })).detail).toMatch(/^\$59,433 more than Hybrid after 30 years, counting/);
    });
  });

  describe('facts', () => {
    it('explains the guaranteed rate, the edge, the deduction, the match, the hybrid and the crossover', () => {
      expect(facts(aStrategyComparison())).toEqual([
        "Paying down the mortgage earns 6.5% for certain. The market's 10% is a long-run average, not a promise, so the ranking counts on 8%, about 6.8% after capital gains tax.",
        'That puts the market 0.3 points ahead after tax and risk, which favors investing.',
        "Your $19,354 of interest in year 1 doesn't lift your deductions above the $32,200 standard deduction, so it saves no tax: paying it down earns the full 6.5%.",
        'Every strategy first puts $600 a month into your 401(k) to collect the full match: $300 a month free, an instant 50% return no mortgage rate can beat. '
          + 'It costs $456 of take-home pay, since it goes in before tax.',
        'The hybrid invests 58% of your extra $544 a month and puts 42% on the mortgage.',
        'With Invest the difference, your investments (after tax) pass what you owe on the mortgage in Aug 2033.',
      ]);
    });

    it('explains an itemized deduction, and a mortgage that beats the market', () => {
      const lines = facts(withRates({ interestIsDeducted: true, firstYearTaxSaved: 16_686.16, firstYearInterest: 48_774.74, standardDeduction: 16_100,
        afterTaxMortgageRate: 4.55, rateEdge: -1.25 }));

      expect(lines[0]).toContain('earns 4.55% for certain after tax');
      expect(lines[1]).toBe('That puts the mortgage 1.25 points ahead after tax and risk, which favors paying it down.');
      expect(lines[2]).toBe('Itemizing beats your $16,100 standard deduction, so the $48,775 of interest in year 1 saves $16,686 in tax. '
        + 'Only deductions above the standard deduction save anything, and the break shrinks as the balance falls.');
    });

    it('says when the two rates are even, and skips capital gains wording when there is none', () => {
      const lines = facts(withRates({ rateEdge: 0, afterTaxRiskAdjustedReturn: 8 }));

      expect(lines[0]).toMatch(/counts on 8%\.$/);
      expect(lines[1]).toBe('After tax and risk the two earn the same.');
    });

    it('counts stock that arrives anyway, and mentions the ESPP', () => {
      const base = aStrategyComparison();
      const lines = facts(aStrategyComparison({
        plan: { ...base.plan, esppContribution: 1_000, employerMatch: 0 },
        rates: { ...base.rates, esppGainPercent: 17.65, automaticAnnualStock: 35_000, hybridInvestPercent: 0 },
      }));

      expect(lines.some((l) => l.includes('401(k)'))).toBe(false);
      expect(lines).toContain('Your ESPP buys stock at a discount and sells it right away: a 17.65% gain on each purchase before tax, taken in every strategy. The proceeds join your extra cash.');
      expect(lines).toContain('Your RSUs and ESOP already put $35,000 a year into stock. The hybrid counts that toward its 58% market share, '
        + 'so it invests 0% of your extra cash and puts all of it on the mortgage: the diversified choice.');
    });

    it('reports a partial split when some stock arrives anyway', () => {
      const base = aStrategyComparison();
      const lines = facts(aStrategyComparison({ rates: { ...base.rates, automaticAnnualStock: 2_000, hybridInvestPercent: 45 } }));

      expect(lines).toContain('Your RSUs and ESOP already put $2,000 a year into stock. The hybrid counts that toward its 58% market share, so it invests 45% of your extra cash.');
    });
  });

  describe('crossover', () => {
    it('says when the investments pass the mortgage, or that they already do, or never will', () => {
      expect(crossover('Hybrid', aStrategyProjection(1, { crossoverMonth: 92, crossoverDate: '2033-08-01' })))
        .toBe('With Hybrid, your investments (after tax) pass what you owe on the mortgage in Aug 2033.');
      expect(crossover('Hybrid', aStrategyProjection(1, { crossoverMonth: 0, crossoverDate: null }))).toContain('already cover the mortgage');
      expect(crossover('Hybrid', aStrategyProjection(1, { crossoverMonth: null, crossoverDate: null }))).toContain('never catch up');
    });
  });

  it('labels each scenario with the return it assumes', () => {
    const result = aStrategyComparison();

    expect(['riskAdjusted', 'expected', 'badDecade'].map((s) => scenarioLabel(result, s as never)))
      .toEqual(['Risk-adjusted (8%)', 'Expected (10%)', 'Bad decade first']);
  });
});
