import { aProjectionYear } from '../../../../testing/builders';
import { equityFooter, equityLines, equityNote } from './equity-lines';

describe('equity lines', () => {
  const year = (n: number, marketValue: number, loanBalance: number) =>
    aProjectionYear(n, { marketValue, loanBalance, equity: marketValue - loanBalance });

  it('stacks what is owed under the equity, so the top edge is the home value', () => {
    const lines = equityLines([year(1, 250_000, 200_000), year(2, 260_000, 196_000)]);

    expect(lines.map((l) => l.label)).toEqual(['Owed on the loan', 'Your equity']);
    expect(lines.map((l) => l.data)).toEqual([[200_000, 196_000], [50_000, 64_000]]);
  });

  it('says where the equity starts and ends, and when the loan is paid off', () => {
    const projection = [year(1, 250_000, 200_000), year(2, 260_000, 100_000), year(3, 270_000, 0), year(4, 280_000, 0)];

    expect(equityNote(projection)).toBe('Your equity grows from $50,000 (the down payment) to $280,000 by year 4. The loan is paid off by year 3, so from then the whole home is yours.');
  });

  it('leaves out the payoff when the loan runs its whole term', () => {
    expect(equityNote([year(1, 250_000, 200_000), year(2, 260_000, 196_000)])).toBe('Your equity grows from $50,000 (the down payment) to $64,000 by year 2.');
  });

  it('gives each year the home value and the share that is yours', () => {
    expect(equityFooter(year(2, 260_000, 195_000))).toBe('Home value: $260,000 · 25% yours');
  });

  it('says nothing without a projection', () => {
    expect(equityNote([])).toBe('');
  });
});

describe('equity chart details', () => {
  it('colours what is owed and the equity apart', () => {
    expect(equityLines([aProjectionYear(1)]).map((l) => l.color)).toEqual(['--series-2', '--series-3']);
  });

  it('says none of a home worth nothing is yours, rather than dividing by zero', () => {
    expect(equityFooter(aProjectionYear(1, { marketValue: 0, equity: 0 }))).toContain('· 0% yours');
  });
});
