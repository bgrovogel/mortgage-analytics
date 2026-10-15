import { STRATEGIES } from './strategy.models';

describe('how each strategy is named and drawn', () => {
  it('names the three ways to use spare cash, in full and in short', () => {
    expect(Object.entries(STRATEGIES).map(([key, s]) => [key, s.name, s.short])).toEqual([
      ['PayOffFirst', 'Debt free ASAP', 'Pay off first'],
      ['InvestTheDifference', 'Invest the difference', 'Invest'],
      ['Hybrid', 'Hybrid', 'Hybrid'],
    ]);
  });

  it('gives each its own colour, which follows the strategy and never its rank', () => {
    expect(Object.values(STRATEGIES).map((s) => s.color)).toEqual(['--series-3', '--series-1', '--series-2']);
  });
});
