import { readZip } from '../../../testing/read-zip';
import { crc32, zip } from './zip';

describe('crc32', () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it('is the standard check value for "123456789"', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });

  it('is zero for nothing', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('tells one byte from another', () => {
    expect(crc32(bytes('a'))).toBe(0xe8b7be43);
    expect(crc32(bytes('b'))).not.toBe(crc32(bytes('a')));
  });
});

describe('zip', () => {
  const entry = (name: string, text: string) => ({ name, data: new TextEncoder().encode(text) });

  it('makes an archive a reader finds every file in, with its name and bytes', () => {
    const archive = zip([entry('a.txt', 'first'), entry('dir/b.xml', '<b/>'), entry('empty', '')]);

    expect(readZip(archive)).toEqual({ 'a.txt': 'first', 'dir/b.xml': '<b/>', empty: '' });
  });

  it('keeps a name with an accent, and text with one', () => {
    expect(readZip(zip([entry('café.txt', 'crème brûlée')]))).toEqual({ 'café.txt': 'crème brûlée' });
  });

  it('makes the same bytes from the same files, so nothing about when it was made leaks in', () => {
    expect(zip([entry('a', 'x')])).toEqual(zip([entry('a', 'x')]));
  });

  it('is only the end record when there is nothing in it', () => {
    expect(zip([])).toHaveLength(22);
  });
});
