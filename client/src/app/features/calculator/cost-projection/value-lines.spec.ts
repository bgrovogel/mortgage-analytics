import { aProjectionYear } from '../../../../testing/builders';
import { YearProjection } from '../../../core/models/amortization.models';
import { aHousingCosts } from '../../../../testing/builders';
import { valueBills, valueLines, valueNote } from './value-lines';

describe('home value lines', () => {
  /** The default example: $375,000, growing slower than the cap, a $140,000 school exemption. */
  const typicalHomestead = (overrides: Partial<YearProjection> = {}) => [
    aProjectionYear(1, { marketValue: 375_000, assessedValue: 375_000, schoolTaxableValue: 235_000, localTaxableValue: 375_000, mudTaxableValue: 375_000, ...overrides }),
    aProjectionYear(2, { marketValue: 390_000, assessedValue: 390_000, schoolTaxableValue: 250_000, localTaxableValue: 390_000, mudTaxableValue: 390_000, ...overrides }),
  ];

  describe('valueLines', () => {
    it('draws a line for every tax that is charged, each in its tax color', () => {
      const lines = valueLines(typicalHomestead());

      expect(lines.map((l) => [l.label, l.data, l.color])).toEqual([
        ['Market value', [375_000, 390_000], '--series-1'],
        ['School taxable value', [235_000, 250_000], '--series-2'],
        ['County & city taxable value', [375_000, 390_000], '--series-3'],
        ['MUD taxable value', [375_000, 390_000], '--series-4'],
      ]);
    });

    it('gives each tax its own line style, so taxes charged on the same value stay visible on top of each other', () => {
      const [, school, local, mud] = valueLines(typicalHomestead());

      expect([school.dashed, school.dotted]).toEqual([undefined, undefined]); // solid
      expect(local.dash).toEqual([12, 6]); // long dashes, unlike the assessed value's short ones
      expect(mud.dotted).toBe(true);
    });

    it('draws a tax charged only in later years, and none for a value the projection does not have', () => {
      const [first, second] = typicalHomestead();
      const missing = { localTaxableValue: undefined as never };
      const labels = valueLines([{ ...first, ...missing, mudTaxableValue: null }, { ...second, ...missing }]).map((l) => l.label);

      expect(labels).toContain('MUD taxable value');
      expect(labels).not.toContain('County & city taxable value');
    });

    it('leaves out a tax that is not charged', () => {
      const labels = valueLines(typicalHomestead({ mudTaxableValue: null })).map((l) => l.label);

      expect(labels).not.toContain('MUD taxable value');
    });

    it('shows the assessed value only once the cap holds it below the market (it is not a tax)', () => {
      expect(valueLines(typicalHomestead()).map((l) => l.label)).not.toContain('Assessed value (capped)');
    });

    it('adds the capped assessed value, dashed and shaded, once the cap holds it below the market', () => {
      const lines = valueLines([
        aProjectionYear(1, { marketValue: 300_000, assessedValue: 300_000 }),
        aProjectionYear(2, { marketValue: 345_000, assessedValue: 330_000 }),
      ]);

      const capped = lines.find((l) => l.label === 'Assessed value (capped)')!;
      expect(capped.color).toBe('--series-7');
      expect(lines.indexOf(capped)).toBe(1); // right after market value, so the shading fills the gap between them
      expect(capped.dashed).toBe(true);
      expect(capped.fillToPrevious).toBe(true);
    });
  });

  describe('valueNote', () => {
    it('says what each tax is charged on in year 1', () => {
      expect(valueNote(typicalHomestead())).toBe(
        'In year 1, after homestead exemptions, school tax is charged on $235,000. '
        + 'County & city tax and MUD tax are charged on the full $375,000 (no exemption entered), so their lines run along the market value.');
    });

    it('adds what the homestead cap keeps off the tax roll by the last year', () => {
      const note = valueNote([
        aProjectionYear(1, { marketValue: 300_000, assessedValue: 300_000, schoolTaxableValue: 160_000 }),
        aProjectionYear(2, { marketValue: 345_000, assessedValue: 330_000, schoolTaxableValue: 190_000 }),
      ]);

      expect(note).toBe('In year 1, after homestead exemptions, school tax is charged on $160,000. '
        + 'By year 2, the homestead cap keeps $15,000 of value off the tax roll.');
    });

    it('says those lines follow the assessed value once the cap holds it below the market', () => {
      const note = valueNote([
        aProjectionYear(1, { marketValue: 300_000, assessedValue: 300_000, localTaxableValue: 300_000 }),
        aProjectionYear(2, { marketValue: 345_000, assessedValue: 330_000, localTaxableValue: 330_000 }),
      ]);

      expect(note).toContain('County & city tax is charged on the full $300,000 (no exemption entered), so its line runs along the assessed value.');
    });

    it('warns when a tax ceiling freezes the bill while the value it is charged on keeps rising', () => {
      const year = (n: number, taxable: number, bill: number) =>
        aProjectionYear(n, { marketValue: 400_000 + n, assessedValue: 400_000 + n, schoolTaxableValue: taxable, costs: aHousingCosts({ schoolTax: bill }) });

      const note = valueNote([year(1, 260_000, 2_600), year(2, 200_000, 2_000), year(3, 210_000, 2_000), year(4, 220_000, 2_000)]);

      expect(note).toContain('From year 2, a tax ceiling holds school tax at $2,000 a year, even as its line keeps rising.');
    });

    it('warns of a ceiling that holds the bill from the first year', () => {
      const year = (n: number) =>
        aProjectionYear(n, { marketValue: 400_000 + n, assessedValue: 400_000 + n, schoolTaxableValue: 200_000 + n, costs: aHousingCosts({ schoolTax: 2_000 }) });

      expect(valueNote([year(1), year(2), year(3)])).toContain('From year 1, a tax ceiling holds school tax');
    });

    it('does not call a steady bill on a steady value a ceiling', () => {
      const year = (n: number) =>
        aProjectionYear(n, { marketValue: 400_000, assessedValue: 400_000, schoolTaxableValue: 200_000, costs: aHousingCosts({ schoolTax: 2_000 }) });

      expect(valueNote([year(1), year(2), year(3)])).not.toContain('ceiling');
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

  describe('valueBills', () => {
    it('lists the year\'s bill for each tax, so every line can be checked against the tax it produces', () => {
      const year = aProjectionYear(1, { costs: aHousingCosts({ schoolTax: 2_350, localTax: 4_125, mudTax: 3_187.5 }) });

      expect(valueBills(year)).toBe('Tax this year: school $2,350 · county & city $4,125 · MUD $3,188');
    });

    it('says nothing when there are no taxes', () => {
      expect(valueBills(aProjectionYear(1))).toBe('');
    });
  });
});
