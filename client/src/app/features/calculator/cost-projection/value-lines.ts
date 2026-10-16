import { ScrubSeries as LineSeries } from '../../../core/charts/scrub-chart.component';
import { usd } from '../../../core/formatting/format';
import { YearProjection } from '../../../core/models/amortization.models';
import { COST_CATEGORIES } from '../../../core/models/cost-categories';

type TaxableKey = 'propertyTaxableValue' | 'schoolTaxableValue' | 'localTaxableValue' | 'mudTaxableValue';

/**
 * Each taxing unit: its taxable value in the projection, its cost category (for the color), and a line style
 * of its own. Taxes are often charged on the same value (county/city and MUD on the full value), so solid,
 * long-dashed and dotted lines (and the assessed value's short dashes) let each show through where they overlap.
 */
const UNITS: readonly { key: TaxableKey; category: 'propertyTax' | 'schoolTax' | 'localTax' | 'mudTax'; name: string; label: string; style: Partial<LineSeries> }[] = [
  { key: 'propertyTaxableValue', category: 'propertyTax', name: 'property tax', label: 'Taxable value', style: {} },
  { key: 'schoolTaxableValue', category: 'schoolTax', name: 'school tax', label: 'School taxable value', style: {} },
  // Long dashes: unlike the assessed value's short ones, which this line can sit on.
  { key: 'localTaxableValue', category: 'localTax', name: 'county & city tax', label: 'County & city taxable value', style: { dash: [12, 6] } },
  { key: 'mudTaxableValue', category: 'mudTax', name: 'MUD tax', label: 'MUD taxable value', style: { dotted: true } },
];

const sameLine = (a: number[], b: number[]) => a.every((value, i) => value === b[i]);
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const colorOf = (category: string) => COST_CATEGORIES.find((c) => c.key === category)!.color;

/** The taxing units charged in this projection, with their taxable values year by year. */
function chargedUnits(projection: YearProjection[]) {
  return UNITS
    .filter((u) => projection.some((y) => y[u.key] !== null && y[u.key] !== undefined))
    .map((u) => ({ ...u, values: projection.map((y) => y[u.key] ?? 0) }));
}

/**
 * The lines of the "home value" chart. In Texas, market value is first held down by the homestead cap
 * (the assessed value); then each taxing unit subtracts its own exemptions. So the chart shows market
 * value, the capped assessed value (only once the cap actually holds it below market), and a line for
 * every tax that is charged: what that tax is charged on.
 */
export function valueLines(projection: YearProjection[]): LineSeries[] {
  const market = projection.map((y) => y.marketValue);
  const assessed = projection.map((y) => y.assessedValue);
  const lines: LineSeries[] = [{ label: 'Market value', color: '--series-1', data: market }];

  if (!sameLine(assessed, market)) {
    // Right after market value, so the shading fills the gap the cap creates.
    lines.push({ label: 'Assessed value (capped)', color: '--series-7', data: assessed, dashed: true, fillToPrevious: true });
  }

  for (const unit of chargedUnits(projection)) {
    lines.push({ label: unit.label, color: colorOf(unit.category), data: unit.values, ...unit.style });
  }
  return lines;
}

/**
 * The takeaway under the chart: what each tax is charged on in year 1, and what the cap keeps off the
 * tax roll by the last year.
 */
export function valueNote(projection: YearProjection[]): string {
  if (projection.length === 0) return '';
  const first = projection[0];
  const last = projection[projection.length - 1];
  const units = chargedUnits(projection);
  const sentences: string[] = [];

  const exempted = units.filter((u) => u.values[0] < first.assessedValue);
  if (exempted.length > 0) {
    const parts = exempted.map((u, i) => `${u.name}${i === 0 ? ' is charged' : ''} on ${usd(u.values[0])}`);
    sentences.push(`In year 1, after homestead exemptions, ${parts.join(' and ')}.`);
  }

  const full = units.filter((u) => u.values[0] === first.assessedValue);
  if (full.length > 0) {
    const names = capitalized(full.map((u) => u.name).join(' and '));
    // Once the cap holds the assessed value below the market, these lines follow it, not the market.
    const along = projection.every((y) => y.assessedValue === y.marketValue) ? 'the market value' : 'the assessed value';
    const lineWord = full.length === 1 ? 'its line runs' : 'their lines run';
    sentences.push(`${names} ${full.length === 1 ? 'is' : 'are'} charged on the full ${usd(first.assessedValue)} (no exemption entered), so ${lineWord} along ${along}.`);
  }

  // An over-65 ceiling freezes a bill: the line keeps rising, the tax does not. Say so, or the chart misleads.
  for (const unit of units) {
    const frozenFrom = ceilingYear(projection, unit);
    if (frozenFrom !== null) {
      sentences.push(`From year ${frozenFrom}, a tax ceiling holds ${unit.name} at ${usd(last.costs[unit.category])} a year, even as its line keeps rising.`);
    }
  }

  const gap = last.marketValue - last.assessedValue;
  if (gap > 0) sentences.push(`By year ${last.year}, the homestead cap keeps ${usd(gap)} of value off the tax roll.`);

  return sentences.length > 0 ? sentences.join(' ') : 'No property taxes are entered, so only the home value is shown.';
}

/** The tooltip footer: that year's bill for each tax, e.g. "Tax this year: school $2,350 · county & city $4,125". */
export function valueBills(year: YearProjection): string {
  const bills = [
    ['property', year.costs.propertyTax],
    ['school', year.costs.schoolTax],
    ['county & city', year.costs.localTax],
    ['MUD', year.costs.mudTax],
  ] as const;
  const charged = bills.filter(([, amount]) => amount > 0).map(([name, amount]) => `${name} ${usd(amount)}`);
  return charged.length > 0 ? `Tax this year: ${charged.join(' · ')}` : '';
}

/**
 * The first year (1-based) from which a unit's bill stays the same to the end of the projection while the
 * value it is charged on grows: a tax ceiling. Null when there is none.
 */
function ceilingYear(projection: YearProjection[], unit: { category: 'propertyTax' | 'schoolTax' | 'localTax' | 'mudTax'; values: number[] }): number | null {
  const last = projection.length - 1;
  const bill = projection[last].costs[unit.category];
  if (bill <= 0) return null;
  let first = last;
  while (first > 0 && projection[first - 1].costs[unit.category] === bill) first--;
  return first < last && unit.values[last] > unit.values[first] ? projection[first].year : null;
}
