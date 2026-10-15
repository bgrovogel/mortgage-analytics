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
}

export const STATE_PROPERTY_TAX_RATES: readonly StateTaxRate[] = [
  { name: 'Alabama', rate: 0.4 },
  { name: 'Alaska', rate: 1.03 },
  { name: 'Arizona', rate: 0.42 },
  { name: 'Arkansas', rate: 0.54 },
  { name: 'California', rate: 0.77 },
  { name: 'Colorado', rate: 0.5 },
  { name: 'Connecticut', rate: 1.63 },
  { name: 'Delaware', rate: 0.49 },
  { name: 'District of Columbia', rate: 0.65 },
  { name: 'Florida', rate: 0.8 },
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

/** The rate for a state, by name, or undefined for a name not in the list. */
export function stateRate(name: string): number | undefined {
  return STATE_PROPERTY_TAX_RATES.find((s) => s.name === name)?.rate;
}
