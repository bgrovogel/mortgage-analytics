import { SHARE_PREFIX, readShareLink, shareFragment } from './share-link';

describe('share links', () => {
  const request = { homePrice: 375_000, note: 'Café “quoted” ½', nothing: null, homes: [{ a: 1 }] };

  it('carries a page’s kind and request in a URL fragment, and reads them back', () => {
    const fragment = shareFragment('Purchase', request);

    expect(fragment.startsWith(SHARE_PREFIX)).toBe(true);
    expect(fragment).toMatch(/^share=[A-Za-z0-9_-]+$/);
    expect(readShareLink(fragment)).toEqual({ kind: 'Purchase', request });
  });

  it('keeps a link URL-safe whatever base64 makes of it: no "+", "/" or "=" padding', () => {
    // ">>>" encodes with a "+", "???" with a "/", and the lengths vary the padding.
    for (const note of ['>>>', '???', '>>>?', '???>>', 'a>>>???']) {
      const fragment = shareFragment('Refinance', { note });

      expect(fragment).toMatch(/^share=[A-Za-z0-9_-]+$/);
      expect(readShareLink(fragment)).toEqual({ kind: 'Refinance', request: { note } });
    }
  });

  it('reads nothing from a fragment that is not a share link', () => {
    expect(readShareLink(null)).toBeNull();
    expect(readShareLink('main-content')).toBeNull();
  });

  it('calls a share link it cannot read broken', () => {
    const broken = 'broken';

    expect(readShareLink(`${SHARE_PREFIX}%%%`)).toBe(broken);
    expect(readShareLink(`${SHARE_PREFIX}${btoa('not json')}`)).toBe(broken);
    expect(readShareLink(SHARE_PREFIX + encode({ v: 2, kind: 'Purchase', request }))).toBe(broken);
    expect(readShareLink(SHARE_PREFIX + encode({ v: 1, kind: 'Mortgage', request }))).toBe(broken);
    expect(readShareLink(SHARE_PREFIX + encode({ v: 1, kind: 'Purchase', request: [1, 2] }))).toBe(broken);
    expect(readShareLink(SHARE_PREFIX + encode({ v: 1, kind: 'Purchase', request: null }))).toBe(broken);
    expect(readShareLink(SHARE_PREFIX + encode({ v: 1, kind: 'Purchase', request: 'a request' }))).toBe(broken);
    expect(readShareLink(SHARE_PREFIX + encode('a payload'))).toBe(broken);
  });

  it('needs one to four homes for a comparison', () => {
    const homes = (n: number) => SHARE_PREFIX + encode({ v: 1, kind: 'HomeComparison', request: { homes: Array.from({ length: n }, () => ({})) } });

    expect(readShareLink(homes(0))).toBe('broken');
    expect(readShareLink(homes(1))).toEqual({ kind: 'HomeComparison', request: { homes: [{}] } });
    expect(readShareLink(SHARE_PREFIX + encode({ v: 1, kind: 'HomeComparison', request: { homes: [{}, 5] } }))).toBe('broken');
    expect(readShareLink(homes(4))).toEqual({ kind: 'HomeComparison', request: { homes: [{}, {}, {}, {}] } });
    expect(readShareLink(homes(5))).toBe('broken');
  });

  /** A payload encoded the way links are, for payloads no page would make. */
  function encode(payload: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
});
