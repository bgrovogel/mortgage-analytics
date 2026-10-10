import { aProjectionYear } from '../../../../testing/builders';
import { YearProjection } from '../../../core/models/amortization.models';
import { valueLines, valueNote } from './value-lines';

describe('home value lines', () => {
  /** The default example: $375,000, growing slower than the cap, a $140,000 school exemption. */
  const typicalHomestead = (overrides: Partial<YearProjection> = {}) => [
    aProjectionYear(1, { marketValue: 375_000, assessedValue: 375_000, schoolTaxableValue: 235_000, localTaxableValue: 375_000, mudTaxableValue: 375_000, ...overrides }),
    aProjectionYear(2, { marketValue: 390_000, assessedValue: 390_000, schoolTaxableValue: 250_000, localTaxableValue: 390_000, mudTaxableValue: 390_000, ...overrides }),
  ];

  describe('valueLines', () => {
    it('draws the home value and what school tax is charged on, after its exemption', () => {
      const lines = valueLines(typicalHomestead());

      expect(lines.map((l) => [l.label, l.data])).toEqual([
        ['Market value', [375_000, 390_000]],
        ['School taxable value', [235_000, 250_000]],
      ]);
      expect(lines[1].color).toBe('--series-2'); // the school tax color, as in every other chart
    });

    it('leaves out a line that would sit exactly on another one, so no line is ever hidden', () => {
      const labels = valueLines(typicalHomestead()).map((l) => l.label);

      expect(labels).not.toContain('Assessed value (capped)'); // growth below the cap: assessed = market
      expect(labels).not.toContain('County & city taxable value'); // no county/city exemption
      expect(labels).not.toContain('MUD taxable value'); // MUDs grant none
    });

    it('adds the capped assessed value, dashed and shaded, once the cap holds it below the market', () => {
      const lines = valueLines([
        aProjectionYear(1, { marketValue: 300_000, assessedValue: 300_000 }),
        aProjectionYear(2, { marketValue: 345_000, assessedValue: 330_000 }),
      ]);

      const capped = lines.find((l) => l.label === 'Assessed value (capped)')!;
      expect(lines.indexOf(capped)).toBe(1); // right after market value, so the shading fills the gap between them
      expect(capped.dashed).toBe(true);
      expect(capped.fillToPrevious).toBe(true);
    });

    it('draws county/city and MUD lines when their exemptions make them differ', () => {
      const labels = valueLines(typicalHomestead({ localTaxableValue: 300_000 })).map((l) => l.label);

      expect(labels).toEqual(['Market value', 'School taxable value', 'County & city taxable value']);
    });
  });

  describe('valueNote', () => {
    it('says what each tax is charged on in year 1', () => {
      expect(valueNote(typicalHomestead())).toBe(
        'In year 1, after homestead exemptions, school tax is charged on $235,000. '
        + 'County & city tax and MUD tax are charged on the full $375,000.');
    });

    it('adds what the homestead cap keeps off the tax roll by the last year', () => {
      const note = valueNote([
        aProjectionYear(1, { marketValue: 300_000, assessedValue: 300_000, schoolTaxableValue: 160_000 }),
        aProjectionYear(2, { marketValue: 345_000, assessedValue: 330_000, schoolTaxableValue: 190_000 }),
      ]);

      expect(note).toBe('In year 1, after homestead exemptions, school tax is charged on $160,000. '
        + 'By year 2, the homestead cap keeps $15,000 of value off the tax roll.');
    });

    it('lists several exempted taxes together', () => {
      expect(valueNote(typicalHomestead({ localTaxableValue: 300_000, mudTaxableValue: null })))
        .toBe('In year 1, after homestead exemptions, school tax is charged on $235,000 and county & city tax on $300,000.');
    });

    it('says when there are no property taxes to show', () => {
      expect(valueNote([aProjectionYear(1)])).toBe('No property taxes are entered, so only the home value is shown.');
      expect(valueNote([])).toBe('');
    });
  });
});
