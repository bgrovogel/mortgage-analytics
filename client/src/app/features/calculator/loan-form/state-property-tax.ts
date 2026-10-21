/**
 * A typical yearly property tax rate for each state and DC, as a percentage of a home's value: the median real estate
 * tax paid divided by the median home value, from the U.S. Census Bureau's 2024 American Community Survey (Table S2506,
 * housing units with a mortgage), as The Motley Fool tabulates it. A starting point for a state with no tax bill in hand:
 * a county, a city and a school district each set their own, and exemptions change what is paid.
 */
export interface StateTaxRate {
  readonly name: string;
  /** Percent of the home's value a year. */
  readonly rate: number;
  /** What is known of how a new buyer in this state is taxed, where it has been checked; most states have none yet. */
  readonly rules?: StateRules;
}

/** How a new buyer's homestead is taxed in a state: what limits the taxed value, and what is taken off it. */
export interface StateRules {
  /** The most the taxed value of a homestead can rise in a year, as a percentage. */
  readonly assessmentCap: number;
  /** A fixed amount taken off the taxed value of a home lived in, if the state's typical rate does not already count it. */
  readonly homesteadExemption?: number;
  /** What the buyer is told: the rule, in a sentence or two. */
  readonly note: string;
}

export const STATE_PROPERTY_TAX_RATES: readonly StateTaxRate[] = [
  { name: 'Alabama', rate: 0.4 },
  { name: 'Alaska', rate: 1.03 },
  { name: 'Arizona', rate: 0.42 },
  { name: 'Arkansas', rate: 0.54 },
  // Not the 0.77% median, which is mostly owners whose values Proposition 13 froze years ago: a buyer now is taxed on the price.
  {
    name: 'California',
    rate: 1.1,
    rules: {
      assessmentCap: 2,
      homesteadExemption: 7_000,
      note: 'A new California buyer is taxed on the purchase price: 1% plus voter-approved debt, about 1.1% in a county like Sacramento, and the taxed value can then rise at most 2% a year. The homeowners\u2019 exemption takes $7,000 off a home you live in. Mello-Roos and other special assessments are extra.',
    },
  },
  { name: 'Colorado', rate: 0.5 },
  { name: 'Connecticut', rate: 1.63 },
  { name: 'Delaware', rate: 0.49 },
  { name: 'District of Columbia', rate: 0.65 },
  {
    name: 'Florida',
    rate: 0.8,
    rules: {
      assessmentCap: 3,
      note: 'After its first year, a Florida homestead\u2019s taxed value can rise at most 3% a year, or inflation if less (Save Our Homes). The typical rate is what is paid after the homestead exemptions, so none is added. Amendment 3 on the November 2026 ballot would raise the exemption on taxes other than school taxes from 2027; this does not assume it passes.',
    },
  },
  { name: 'Georgia', rate: 0.81 },
  { name: 'Hawaii', rate: 0.27 },
  { name: 'Idaho', rate: 0.43 },
  { name: 'Illinois', rate: 1.96 },
  { name: 'Indiana', rate: 0.73 },
  { name: 'Iowa', rate: 1.31 },
  { name: 'Kansas', rate: 1.23 },
  { name: 'Kentucky', rate: 0.73 },
  { name: 'Louisiana', rate: 0.58 },
  { name: 'Maine', rate: 0.91 },
  { name: 'Maryland', rate: 0.95 },
  { name: 'Massachusetts', rate: 0.99 },
  { name: 'Michigan', rate: 1.19 },
  { name: 'Minnesota', rate: 1.02 },
  { name: 'Mississippi', rate: 0.64 },
  { name: 'Missouri', rate: 0.82 },
  { name: 'Montana', rate: 0.68 },
  { name: 'Nebraska', rate: 1.43 },
  { name: 'Nevada', rate: 0.48 },
  { name: 'New Hampshire', rate: 1.44 },
  { name: 'New Jersey', rate: 1.85 },
  { name: 'New Mexico', rate: 0.68 },
  { name: 'New York', rate: 1.43 },
  { name: 'North Carolina', rate: 0.63 },
  { name: 'North Dakota', rate: 0.98 },
  { name: 'Ohio', rate: 1.23 },
  { name: 'Oklahoma', rate: 0.84 },
  { name: 'Oregon', rate: 0.77 },
  { name: 'Pennsylvania', rate: 1.18 },
  { name: 'Rhode Island', rate: 1.1 },
  { name: 'South Carolina', rate: 0.46 },
  { name: 'South Dakota', rate: 1.02 },
  { name: 'Tennessee', rate: 0.46 },
  { name: 'Texas', rate: 1.49 },
  { name: 'Utah', rate: 0.48 },
  { name: 'Vermont', rate: 1.44 },
  { name: 'Virginia', rate: 0.71 },
  { name: 'Washington', rate: 0.77 },
  { name: 'West Virginia', rate: 0.54 },
  { name: 'Wisconsin', rate: 1.23 },
  { name: 'Wyoming', rate: 0.57 },
];

/** The rules for a new buyer in a state, by name, or undefined where they have not been checked. */
export function stateRules(name: string): StateRules | undefined {
  return STATE_PROPERTY_TAX_RATES.find((s) => s.name === name)?.rules;
}

/** The rate for a state, by name, or undefined for a name not in the list. */
export function stateRate(name: string): number | undefined {
  return STATE_PROPERTY_TAX_RATES.find((s) => s.name === name)?.rate;
}
