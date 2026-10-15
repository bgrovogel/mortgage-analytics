import { STATE_PROPERTY_TAX_RATES, stateRate } from './state-property-tax';

describe('typical property tax rates by state', () => {
  it('has the fifty states and the District of Columbia, each once, in alphabetical order', () => {
    const names = STATE_PROPERTY_TAX_RATES.map((s) => s.name);

    expect(names).toHaveLength(51);
    expect(new Set(names).size).toBe(51);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('keeps every rate within what the form accepts, to the hundredth of a percent', () => {
    for (const { name, rate } of STATE_PROPERTY_TAX_RATES) {
      expect({ name, ok: rate > 0 && rate <= 10 && Math.round(rate * 100) / 100 === rate }).toEqual({ name, ok: true });
    }
  });

  it('finds a state by name, and nothing for a name it does not know', () => {
    expect(stateRate('Texas')).toBe(1.49);
    expect(stateRate('Hawaii')).toBe(0.27);
    expect(stateRate('Atlantis')).toBeUndefined();
  });
});
