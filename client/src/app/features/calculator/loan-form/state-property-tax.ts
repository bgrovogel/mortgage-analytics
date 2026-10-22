import { msg, t } from '../../../core/i18n/i18n';

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
  { name: msg('Alabama'), rate: 0.4 },
  { name: msg('Alaska'), rate: 1.03 },
  { name: msg('Arizona'), rate: 0.42 },
  { name: msg('Arkansas'), rate: 0.54 },
  // Not the 0.77% median, which is mostly owners whose values Proposition 13 froze years ago: a buyer now is taxed on the price.
  {
    name: msg('California'),
    rate: 1.1,
    rules: {
      assessmentCap: 2,
      homesteadExemption: 7_000,
      get note() { return t('A new California buyer is taxed on the purchase price: 1% plus voter-approved debt, about 1.1% in a county like Sacramento, and the taxed value can then rise at most 2% a year. The homeowners’ exemption takes $7,000 off a home you live in. Mello-Roos and other special assessments are extra.'); },
    },
  },
  { name: msg('Colorado'), rate: 0.5 },
  { name: msg('Connecticut'), rate: 1.63 },
  { name: msg('Delaware'), rate: 0.49 },
  { name: msg('District of Columbia'), rate: 0.65 },
  {
    name: msg('Florida'),
    rate: 0.8,
    rules: {
      assessmentCap: 3,
      get note() { return t('After its first year, a Florida homestead’s taxed value can rise at most 3% a year, or inflation if less (Save Our Homes). The typical rate is what is paid after the homestead exemptions, so none is added. Amendment 3 on the November 2026 ballot would raise the exemption on taxes other than school taxes from 2027; this does not assume it passes.'); },
    },
  },
  { name: msg('Georgia'), rate: 0.81 },
  { name: msg('Hawaii'), rate: 0.27 },
  { name: msg('Idaho'), rate: 0.43 },
  { name: msg('Illinois'), rate: 1.96 },
  { name: msg('Indiana'), rate: 0.73 },
  { name: msg('Iowa'), rate: 1.31 },
  { name: msg('Kansas'), rate: 1.23 },
  { name: msg('Kentucky'), rate: 0.73 },
  { name: msg('Louisiana'), rate: 0.58 },
  { name: msg('Maine'), rate: 0.91 },
  { name: msg('Maryland'), rate: 0.95 },
  { name: msg('Massachusetts'), rate: 0.99 },
  {
    name: msg('Michigan'),
    rate: 1.19,
    rules: {
      // 2026's inflation rate multiplier (State Tax Commission Bulletin 14 of 2025); the law is the lesser of that or 5%.
      assessmentCap: 2.7,
      get note() { return t('In Michigan the taxed value of a home can rise each year by the lesser of inflation or 5%: 2.7% for 2026 (an inflation rate multiplier of 1.027), the figure used here, which changes every year. It holds only until the home is sold: the year after a purchase the taxed value is reset to half the market value, and the cap starts again the year after. The typical rate is what is paid after the Principal Residence Exemption from school operating taxes, so none is added.'); },
    },
  },
  { name: msg('Minnesota'), rate: 1.02 },
  { name: msg('Mississippi'), rate: 0.64 },
  { name: msg('Missouri'), rate: 0.82 },
  { name: msg('Montana'), rate: 0.68 },
  { name: msg('Nebraska'), rate: 1.43 },
  { name: msg('Nevada'), rate: 0.48 },
  { name: msg('New Hampshire'), rate: 1.44 },
  { name: msg('New Jersey'), rate: 1.85 },
  { name: msg('New Mexico'), rate: 0.68 },
  { name: msg('New York'), rate: 1.43 },
  { name: msg('North Carolina'), rate: 0.63 },
  { name: msg('North Dakota'), rate: 0.98 },
  { name: msg('Ohio'), rate: 1.23 },
  {
    name: msg('Oklahoma'),
    rate: 0.84,
    rules: {
      assessmentCap: 3,
      get note() { return t('In Oklahoma the value a homestead is taxed on can rise at most 3% a year, but only until the home is sold: in the year of a purchase it is set at market value. The $1,000 homestead exemption comes off the assessed value and saves about $80 to $120 a year; it is already in the typical rate, so none is added. State Question 847, on the November 3, 2026 ballot, would lower the cap to 1.75% from tax year 2027; this does not assume it passes.'); },
    },
  },
  { name: msg('Oregon'), rate: 0.77 },
  { name: msg('Pennsylvania'), rate: 1.18 },
  { name: msg('Rhode Island'), rate: 1.1 },
  { name: msg('South Carolina'), rate: 0.46 },
  { name: msg('South Dakota'), rate: 1.02 },
  { name: msg('Tennessee'), rate: 0.46 },
  { name: msg('Texas'), rate: 1.49 },
  { name: msg('Utah'), rate: 0.48 },
  { name: msg('Vermont'), rate: 1.44 },
  { name: msg('Virginia'), rate: 0.71 },
  { name: msg('Washington'), rate: 0.77 },
  { name: msg('West Virginia'), rate: 0.54 },
  { name: msg('Wisconsin'), rate: 1.23 },
  { name: msg('Wyoming'), rate: 0.57 },
];

/** The rules for a new buyer in a state, by name, or undefined where they have not been checked. */
export function stateRules(name: string): StateRules | undefined {
  return STATE_PROPERTY_TAX_RATES.find((s) => s.name === name)?.rules;
}

/** The rate for a state, by name, or undefined for a name not in the list. */
export function stateRate(name: string): number | undefined {
  return STATE_PROPERTY_TAX_RATES.find((s) => s.name === name)?.rate;
}
