import { parseRich } from './rich-text';

describe('parseRich', () => {
  it('leaves a message without markup as one piece of text', () => {
    expect(parseRich('Just words.')).toEqual([{ kind: 'text', text: 'Just words.' }]);
  });

  it('reads bold, a link to a page, and a glossary term, in the place the sentence puts them', () => {
    expect(parseRich('It is [b]6.687%[/b] in the [link:/glossary]glossary[/link], see [term:Escrow]escrow[/term].')).toEqual([
      { kind: 'text', text: 'It is ' },
      { kind: 'bold', children: [{ kind: 'text', text: '6.687%' }] },
      { kind: 'text', text: ' in the ' },
      { kind: 'link', to: '/glossary', children: [{ kind: 'text', text: 'glossary' }] },
      { kind: 'text', text: ', see ' },
      { kind: 'term', of: 'Escrow', children: [{ kind: 'text', text: 'escrow' }] },
      { kind: 'text', text: '.' },
    ]);
  });

  it('nests a term in bold', () => {
    expect(parseRich('[b][term:PMI]PMI[/term][/b]!')).toEqual([
      { kind: 'bold', children: [{ kind: 'term', of: 'PMI', children: [{ kind: 'text', text: 'PMI' }] }] },
      { kind: 'text', text: '!' },
    ]);
  });

  it('keeps a stray or unmatched tag as the text it was', () => {
    expect(parseRich('a [/b] b')).toEqual([{ kind: 'text', text: 'a [/b] b' }]);
    expect(parseRich('[b]open')).toEqual([{ kind: 'bold', children: [{ kind: 'text', text: 'open' }] }]);
  });
});
