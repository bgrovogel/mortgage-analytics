import { aStrategyComparison, aStrategyProjection } from '../../../testing/builders';
import { StrategyComparison } from '../../core/models/strategy.models';
import { signedUsd } from '../../core/formatting/format';
import { closeness, crossover, facts, recommendation, scenarioLabel } from './strategy-text';

describe('strategy text', () => {
  const withRates = (rates: Partial<StrategyComparison['rates']>, rest: Partial<StrategyComparison> = {}) => {
    const base = aStrategyComparison();
    return aStrategyComparison({ ...rest, rates: { ...base.rates, ...rates } });
  };

  describe('recommendation', () => {
    it('names the winner, its lead, and the risk-adjusted return it rests on', () => {
      const r = recommendation(aStrategyComparison());

      expect(r.headline).toBe('Invest the difference');
      expect(r.detail).toBe('$18,150 ahead of Hybrid after 30 years, counting on 8% a year (your 10% less 2 points for risk).');
    });

    it('warns, with the amount, when a lost decade would reverse it', () => {
      const r = recommendation(aStrategyComparison());

      expect(r.reversible).toBe(true);
      // 3,187,295.65 − 3,145,932.42
      expect(r.downside).toBe('Not guaranteed: after a lost decade (-1% a year, like 2000–2009), Debt free ASAP would win by $41,363.');
    });

    it('reassures when a lost decade would not change it', () => {
      const r = recommendation(aStrategyComparison({ badDecadeWinner: 'InvestTheDifference' }));

      expect(r.reversible).toBe(false);
      expect(r.downside).toBe('It stays ahead even after a lost decade (-1% a year, like 2000–2009).');
    });

    it('explains a tie, and an aggressive profile that counts on the full return', () => {
      const r = recommendation(withRates({ riskMargin: 0, riskAdjustedReturn: 10 }, { lead: 0, recommended: 'PayOffFirst', runnerUp: 'Hybrid' }));

      expect(r.detail).toBe('Tied with Hybrid after 30 years, counting on your full 10% a year. Paying down debt carries no market risk, so it takes the tie.');
    });
  });

  describe('closeness', () => {
    it('says how close the strategies end, and why: most of net worth is the same in all three', () => {
      // 3,844,781.09 − 3,719,026.59 = 125,754.50, which is 3.3% of the best.
      expect(closeness(aStrategyComparison())).toBe(
        'All three end within $125,755 (3.3%) of each other. Most of your net worth is the same whichever you choose: '
        + 'the home ($700,000 by year 30), your 401(k) and match, and what you have already saved. '
        + 'Only the $544 a month of extra cash, and the $2,026 payment once the mortgage is gone, go somewhere different.');
    });

    it('says when they end exactly the same, and leaves out a match there is none of', () => {
      const base = aStrategyComparison();
      const same = aStrategyComparison({
        plan: { ...base.plan, employerMatch: 0 },
        strategies: base.strategies.map((o) => ({ ...o, riskAdjusted: base.strategies[0].riskAdjusted })),
      });

      expect(closeness(same)).toMatch(/^All three end the same\. /);
      expect(closeness(same)).toContain('your retirement savings');
    });
  });

  it('signs differences, and shows none as $0', () => {
    expect([signedUsd(1_234.4), signedUsd(-1_234.6), signedUsd(0.2)]).toEqual(['+$1,234', '−$1,235', '$0']);
  });

  describe('facts', () => {
    it('explains the guaranteed rate, the tax on investing, the deduction, the match and the hybrid', () => {
      expect(facts(aStrategyComparison())).toEqual([
        "Paying down the mortgage earns 6.5% for certain. The market's 10% is an average, not a promise, so the ranking counts on 8%.",
        'Your extra cash fits in your IRA, so it grows tax-free: the full 8%. That leaves investing 1.5 points ahead.',
        "Your $19,354 of year-1 interest doesn't beat the $32,200 standard deduction, so it saves no tax: paying it down earns the full 6.5%.",
        'Every strategy first collects the full 401(k) match: $300 a month free for $456 of take-home pay, an instant 50% return no mortgage can beat.',
        'The hybrid invests 88% of your extra cash and puts 12% on the mortgage.',
      ]);
    });

    it('blends the IRA with a taxable account, taxed only when sold', () => {
      expect(facts(withRates({ iraShelteredPercent: 25, afterTaxRiskAdjustedReturn: 7.56, rateEdge: 1.06 }))[1]).toBe(
        '25% of your extra cash fits in your IRA, tax-free; the rest, taxed only when sold, keeps about 7.41% a year. Together: 7.56%. '
        + 'That leaves investing 1.06 points ahead.');
      expect(facts(withRates({ iraShelteredPercent: 0, afterTaxRiskAdjustedReturn: 7.41 }))[1])
        .toMatch(/^Invested cash goes to a taxable account: taxed only when sold, keeps about 7\.41% a year\./);
    });

    it('explains an itemized deduction, and a mortgage that beats the market', () => {
      const lines = facts(withRates({ interestIsDeducted: true, firstYearTaxSaved: 16_686.16, firstYearInterest: 48_774.74, standardDeduction: 16_100,
        afterTaxMortgageRate: 4.55, rateEdge: -1.25 }));

      expect(lines[0]).toContain('earns 4.55% for certain after tax');
      expect(lines[1]).toContain('That leaves the mortgage 1.25 points ahead.');
      expect(lines[2]).toBe('Itemizing beats your $16,100 standard deduction, so year-1 interest of $48,775 saves $16,686 in tax. '
        + 'That shrinks as the balance falls and the standard deduction rises with inflation.');
    });

    it('says when the two rates are even', () => {
      expect(facts(withRates({ rateEdge: 0 }))[1]).toContain('That leaves the two even.');
    });

    it('counts stock that arrives anyway, and mentions the ESPP', () => {
      const base = aStrategyComparison();
      const lines = facts(aStrategyComparison({
        plan: { ...base.plan, esppContribution: 1_000, employerMatch: 0 },
        rates: { ...base.rates, esppGainPercent: 17.65, automaticAnnualStock: 55_000, hybridInvestPercent: 0 },
      }));

      expect(lines.some((l) => l.includes('401(k)'))).toBe(false);
      expect(lines).toContain('Every strategy takes the ESPP discount too: a 17.65% gain on each purchase, before tax.');
      expect(lines).toContain('RSUs and ESOP already put $55,000 a year into stock, which counts toward the hybrid\'s 88% market share. '
        + 'So it invests 0% of your extra cash and puts the rest on the mortgage: the diversified choice.');
    });

    it('reports a partial split when some stock arrives anyway', () => {
      const base = aStrategyComparison();
      const lines = facts(aStrategyComparison({ rates: { ...base.rates, automaticAnnualStock: 2_000, hybridInvestPercent: 84 } }));

      expect(lines[lines.length - 1]).toBe('RSUs and ESOP already put $2,000 a year into stock, which counts toward the hybrid\'s 88% market share. '
        + 'So it invests 84% of your extra cash, and puts the rest on the mortgage.');
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
  it('says an adjustable rate earns its average, and that a buydown frees cash', () => {
    const arm = aStrategyComparison();
    arm.rates = { ...arm.rates, mortgageRate: 6.5, averageMortgageRate: 8.1, afterTaxMortgageRate: 8.1, interestIsDeducted: false };
    expect(facts(arm)[0]).toContain('Your rate adjusts: 6.5% now, 8.1% on average over the loan on the path you expect, so paying it down earns about 8.1%');

    const buydown = aStrategyComparison();
    buydown.rates = { ...buydown.rates, buydownSubsidy: 6_827.64 };
    expect(facts(buydown)).toContain('The buydown pays $6,828 of your payments in its first years: in every strategy, that cash goes to work too.');
  });
});
