import { parseTags, tagsText } from './tags';

describe('tags', () => {
  it('are typed separated by commas, and trimmed, without blanks or repeats in any case', () => {
    expect(parseTags('  Oak St , roof,, OAK ST ,  ')).toEqual(['Oak St', 'roof']);
    expect(parseTags('')).toEqual([]);
  });

  it('are shown the way they are typed', () => {
    expect(tagsText(['Oak St', 'roof'])).toBe('Oak St, roof');
    expect(tagsText(undefined)).toBe('');
  });
});
