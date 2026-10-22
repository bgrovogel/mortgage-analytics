import { STATE_PROPERTY_TAX_RATES, stateRate, stateRules } from './state-property-tax';

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

  it('gives the rules of a new buyer for California and Florida, and none for a state it has not checked', () => {
    expect(stateRules('California')).toMatchObject({ assessmentCap: 2, homesteadExemption: 7_000 });
    expect(stateRules('Florida')).toMatchObject({ assessmentCap: 3 });
    expect(stateRules('Florida')?.homesteadExemption).toBeUndefined();
    expect(stateRules('Ohio')).toBeUndefined();
    expect(stateRules('Atlantis')).toBeUndefined();
  });

  it('gives the rules of a new buyer for Michigan and Oklahoma: a cap that a sale resets, and no exemption added to a typical rate that already has it', () => {
    expect(stateRules('Michigan')).toMatchObject({ assessmentCap: 2.7 });
    expect(stateRules('Michigan')?.homesteadExemption).toBeUndefined();
    expect(stateRules('Oklahoma')).toMatchObject({ assessmentCap: 3 });
    expect(stateRules('Oklahoma')?.homesteadExemption).toBeUndefined();
  });

  it('says in each note what the cap holds to, until when, and what is not assumed', () => {
    expect(stateRules('Michigan')?.note).toContain('1.027');
    expect(stateRules('Michigan')?.note).toContain('sold');
    expect(stateRules('Oklahoma')?.note).toContain('State Question 847');
    expect(stateRules('Oklahoma')?.note).toContain('does not assume it passes');
  });

  it('starts a new California buyer at the rate on the purchase price, not the median of owners whose values Proposition 13 froze', () => {
    expect(stateRate('California')).toBe(1.1);
  });

  it('finds a state by name, and nothing for a name it does not know', () => {
    expect(stateRate('Texas')).toBe(1.49);
    expect(stateRate('Hawaii')).toBe(0.27);
    expect(stateRate('Atlantis')).toBeUndefined();
  });
});
