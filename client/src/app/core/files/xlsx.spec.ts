import { columnLetters, excelDate, sheetName, xlsx } from './xlsx';
import { readZip } from '../../../testing/read-zip';

describe('the workbook parts', () => {
  it('names columns as a spreadsheet does', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetters)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  });

  it('counts a date as the days since 30 December 1899', () => {
    expect(excelDate('1900-01-01')).toBe(2);
    expect(excelDate('2026-01-01')).toBe(46_023);
    expect(excelDate('2026-10-21')).toBe(46_316);
  });

  it('keeps a sheet name to what a spreadsheet allows', () => {
    expect(sheetName('Payments: [standard]/extra')).toBe('Payments   standard  extra');
    expect(sheetName('x'.repeat(40))).toHaveLength(31);
    expect(sheetName('  ')).toBe('Sheet');
  });
});

describe('xlsx', () => {
  const files = (sheets: Parameters<typeof xlsx>[0]) => readZip(xlsx(sheets));

  it('is a ZIP of the parts every workbook has, with a sheet for each', () => {
    const parts = files([{ name: 'First', rows: [['a']] }, { name: 'Second', rows: [['b']] }]);

    expect(Object.keys(parts).sort()).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml',
      'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
    ]);
    expect(parts['xl/workbook.xml']).toContain('<sheet name="First" sheetId="1" r:id="rId1"/><sheet name="Second" sheetId="2" r:id="rId2"/>');
    expect(parts['xl/_rels/workbook.xml.rels']).toContain('Target="worksheets/sheet2.xml"');
    expect(parts['xl/_rels/workbook.xml.rels']).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"');
    expect(parts['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml');
  });

  it('writes text inline and numbers as numbers, at the cell each sits in', () => {
    const sheet = files([{ name: 'S', rows: [['Name', 'Amount'], ['Rent', 1234.5], [null, 7]] }])['xl/worksheets/sheet1.xml'];

    expect(sheet).toContain('<c r="A1" t="inlineStr"><is><t xml:space="preserve">Name</t></is></c>');
    expect(sheet).toContain('<c r="B2"><v>1234.5</v></c>');
    expect(sheet).toContain('<row r="3"><c r="B3"><v>7</v></c></row>');
  });

  it('escapes what XML does, and drops control characters', () => {
    const sheet = files([{ name: 'S', rows: [['a < b & "c" > d\u0001']] }])['xl/worksheets/sheet1.xml'];

    expect(sheet).toContain('a &lt; b &amp; &quot;c&quot; &gt; d</t>');
  });

  it('styles money, percentages, whole numbers, dates and headings, by the number each format has in the styles', () => {
    const rows = [[
      { value: 'H', style: 'heading' as const }, { value: 5, style: 'money' as const }, { value: 6.5, style: 'percent' as const },
      { value: 9, style: 'integer' as const }, { value: '2026-10-21', style: 'date' as const }, { value: 'T', style: 'bold' as const }, { value: 1, style: 'moneyBold' as const },
    ]];
    const sheet = files([{ name: 'S', rows }])['xl/worksheets/sheet1.xml'];

    expect(sheet).toContain('<c r="A1" s="2" t="inlineStr">');
    expect(sheet).toContain('<c r="B1" s="3"><v>5</v></c>');
    expect(sheet).toContain('<c r="C1" s="5"><v>6.5</v></c>');
    expect(sheet).toContain('<c r="D1" s="6"><v>9</v></c>');
    expect(sheet).toContain('<c r="E1" s="7"><v>46316</v></c>');
    expect(sheet).toContain('<c r="F1" s="1" t="inlineStr">');
    expect(sheet).toContain('<c r="G1" s="4"><v>1</v></c>');
  });

  it('defines every format it refers to: $ to the cent, a percentage, and the eight cell formats', () => {
    const styles = files([{ name: 'S', rows: [] }])['xl/styles.xml'];

    expect(styles).toContain('formatCode="&quot;$&quot;#,##0.00"');
    expect(styles).toContain('formatCode="0.00&quot;%&quot;"');
    expect(styles).toContain('<cellXfs count="8">');
    expect((styles.match(/<xf /g) ?? []).length).toBe(9); // the one cell style, and the eight cell formats
    expect(styles).toContain('<cellStyle name="Normal" xfId="0" builtinId="0"/>');
  });

  it('sets column widths and keeps the header in view when asked', () => {
    const sheet = files([{ name: 'S', rows: [['a']], widths: [12, 30], freezeHeader: true }])['xl/worksheets/sheet1.xml'];

    expect(sheet).toContain('<col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/>');
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
  });

  it('leaves a missing value as an empty cell', () => {
    const sheet = files([{ name: 'S', rows: [[{ value: undefined as unknown as string, style: 'date' }, 2]] }])['xl/worksheets/sheet1.xml'];

    expect(sheet).toContain('<row r="1"><c r="B1"><v>2</v></c></row>');
  });

  it('leaves out a number that is not one, rather than write a file Excel would refuse', () => {
    const sheet = files([{ name: 'S', rows: [[NaN, Infinity, 3]] }])['xl/worksheets/sheet1.xml'];

    expect(sheet).not.toContain('NaN');
    expect(sheet).not.toContain('Infinity');
    expect(sheet).toContain('<c r="C1"><v>3</v></c>');
  });
});
