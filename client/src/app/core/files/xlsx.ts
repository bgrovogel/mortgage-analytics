import { zip } from './zip';

/** How a cell's number is shown. Text and plain numbers need no style. */
export type CellStyle = 'bold' | 'heading' | 'money' | 'moneyBold' | 'percent' | 'integer' | 'date';

/** A cell: a value, and optionally how to show it. A date is a yyyy-MM-dd string, written as the date a spreadsheet counts with. */
export interface Cell {
  value: string | number | null;
  style?: CellStyle;
}

/** One sheet: its name, its rows (a bare value is an unstyled cell), and how wide its columns are. */
export interface Sheet {
  name: string;
  rows: readonly (readonly (Cell | string | number | null)[])[];
  /** Column widths, in characters. */
  widths?: readonly number[];
  /** Keeps the first row in view while the rest scrolls. */
  freezeHeader?: boolean;
}

/** Each style's position in the workbook's list of cell formats (styles.xml), which a cell names by number. */
const STYLE_INDEX: Record<CellStyle, number> = { bold: 1, heading: 2, money: 3, moneyBold: 4, percent: 5, integer: 6, date: 7 };

/** What a spreadsheet may not put in a sheet's name, or in a cell's text (control characters). */
// eslint-disable-next-line no-control-regex
const NOT_IN_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

const xml = (text: string) =>
  text.replace(NOT_IN_TEXT, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A sheet's name as a spreadsheet allows: at most 31 characters, none of `[]:*?/\`. */
export function sheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
}

/** The letters that name a column: 0 is A, 25 is Z, 26 is AA. */
export function columnLetters(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

/** The number a spreadsheet counts a date as: the days since 30 December 1899. */
export function excelDate(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function cellXml(reference: string, input: Cell | string | number | null): string {
  const cell: Cell = input !== null && typeof input === 'object' ? input : { value: input };
  // A value that is missing, whatever the types say, is an empty cell, not a crash that loses the whole workbook.
  if (cell.value === null || cell.value === undefined || cell.value === '') return '';
  const style = cell.style ? ` s="${STYLE_INDEX[cell.style]}"` : '';
  if (typeof cell.value === 'number') return !Number.isFinite(cell.value) ? '' : `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
  if (cell.style === 'date') return `<c r="${reference}"${style}><v>${excelDate(cell.value)}</v></c>`;
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const view = sheet.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rows = sheet.rows
    .map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => cellXml(`${columnLetters(c)}${r + 1}`, cell)).join('')}</row>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

/**
 * The formats the cells use: bold, a heading with a line under it, money to the cent, a percentage, a whole number and a date.
 * Index 0 is the plain default, and the others are in the order of {@link STYLE_INDEX}.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + `<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/></numFmts>`
  + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
  + `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>`
  + `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>`
  + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  + `<cellXfs count="8">`
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
  + `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>`
  + `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>`
  + `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `<xf numFmtId="15" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
  + `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/**
 * An Excel workbook (.xlsx) of the sheets: the Office Open XML parts in a ZIP. Text is written inline, numbers as
 * numbers (so Excel can add them up), money, percentages and dates with formats that show them as such.
 */
export function xlsx(sheets: readonly Sheet[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const named = sheets.map((sheet, i) => ({ ...sheet, name: sheetName(sheet.name), id: i + 1 }));
  const part = (name: string, text: string) => ({ name, data: encoder.encode(text) });
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  return zip([
    part('[Content_Types].xml', `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
      + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
      + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
      + named.map((s) => `<Override PartName="/xl/worksheets/sheet${s.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + `</Types>`),
    part('_rels/.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    part('xl/workbook.xml', `${head}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheets>${named.map((s) => `<sheet name="${xml(s.name)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join('')}</sheets></workbook>`),
    part('xl/_rels/workbook.xml.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + named.map((s) => `<Relationship Id="rId${s.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${s.id}.xml"/>`).join('')
      + `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    part('xl/styles.xml', STYLES),
    ...named.map((s) => part(`xl/worksheets/sheet${s.id}.xml`, sheetXml(s))),
  ]);
}
