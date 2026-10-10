import { LineSeries, currency } from '../../../core/charts/line-chart';
import { YearProjection } from '../../../core/models/amortization.models';
import { COST_CATEGORIES } from '../../../core/models/cost-categories';

type TaxableKey = 'schoolTaxableValue' | 'localTaxableValue' | 'mudTaxableValue';

/** Each taxing unit: its taxable value in the projection, and its cost category (for the color). */
const UNITS: readonly { key: TaxableKey; category: 'schoolTax' | 'localTax' | 'mudTax'; name: string }[] = [
  { key: 'schoolTaxableValue', category: 'schoolTax', name: 'school tax' },
  { key: 'localTaxableValue', category: 'localTax', name: 'county & city tax' },
  { key: 'mudTaxableValue', category: 'mudTax', name: 'MUD tax' },
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
 * value, the capped assessed value, and what each tax is actually charged on.
 *
 * A line identical to the one it would overlap is left out (assessed value when the cap never applies,
 * a tax with no exemption), so no line is ever hidden behind another; the note names those instead.
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
    if (!sameLine(unit.values, assessed)) {
      const label = unit.key === 'localTaxableValue' ? 'County & city taxable value' : `${capitalized(unit.name.replace(' tax', ''))} taxable value`;
      lines.push({ label, color: colorOf(unit.category), data: unit.values });
    }
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
    const parts = exempted.map((u, i) => `${u.name}${i === 0 ? ' is charged' : ''} on ${currency.format(u.values[0])}`);
    sentences.push(`In year 1, after homestead exemptions, ${parts.join(' and ')}.`);
  }

  const full = units.filter((u) => u.values[0] === first.assessedValue);
  if (full.length > 0) {
    const names = capitalized(full.map((u) => u.name).join(' and '));
    sentences.push(`${names} ${full.length === 1 ? 'is' : 'are'} charged on the full ${currency.format(first.assessedValue)}.`);
  }

  const gap = last.marketValue - last.assessedValue;
  if (gap > 0) sentences.push(`By year ${last.year}, the homestead cap keeps ${currency.format(gap)} of value off the tax roll.`);

  return sentences.length > 0 ? sentences.join(' ') : 'No property taxes are entered, so only the home value is shown.';
}
