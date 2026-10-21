/** One file in a ZIP archive: its path inside, and its bytes. */
export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * The CRC-32 table (the polynomial ZIP uses), built in a function so each of its 256 figures is exercised by the tests
 * that call it rather than sitting unchecked as a constant.
 */
function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

/** The CRC-32 of some bytes, which ZIP records for each file so a reader can tell it arrived whole. */
export function crc32(bytes: Uint8Array): number {
  const table = crcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 1 January 2026, 00:00, as DOS dates and times are written: a fixed stamp, so the same files always make the same bytes. */
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

/** The flag for names written as UTF-8, so a name with an accent reads right everywhere. */
const UTF8_NAMES = 0x0800;

/**
 * A ZIP archive of the entries, each stored without compression. That is the simplest form every ZIP reader (and so every
 * Office file, which is a ZIP of XML) understands, and for a few hundred kilobytes of text it is as good as any.
 */
export function zip(entries: readonly ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, UTF8_NAMES, true);
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, entry.data.length, true); // compressed size
    local.setUint32(22, entry.data.length, true); // uncompressed size
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true); // no extra field
    parts.push(new Uint8Array(local.buffer), name, entry.data);

    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true); // central directory header
    header.setUint16(4, 20, true); // version made by
    header.setUint16(6, 20, true); // version needed
    header.setUint16(8, UTF8_NAMES, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, DOS_TIME, true);
    header.setUint16(14, DOS_DATE, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, entry.data.length, true);
    header.setUint32(24, entry.data.length, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true); // where its local header is
    central.push(new Uint8Array(header.buffer), name);

    offset += 30 + name.length + entry.data.length;
  }

  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true); // entries on this disk
  end.setUint16(10, entries.length, true); // entries in all
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true); // where the directory starts

  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const bytes = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    bytes.set(part, at);
    at += part.length;
  }
  return bytes;
}
