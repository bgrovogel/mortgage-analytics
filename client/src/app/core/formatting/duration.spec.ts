import { formatMonths } from './duration';

describe('formatMonths', () => {
  it.each([
    [0, '0 mo'],
    [5, '5 mo'],
    [12, '1 yr'],
    [27, '2 yr 3 mo'],
    [108, '9 yr'],
  ])('formats %i months as "%s"', (months, expected) => {
    expect(formatMonths(months)).toBe(expected);
  });
});
