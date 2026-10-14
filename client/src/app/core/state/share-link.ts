import { SavedCalculationKind } from '../models/saved-calculation.models';

/**
 * Share links: a page's inputs in the URL's fragment, e.g. `/calculator/overview#share=eyJ2Ijox…`. A fragment never
 * leaves the browser (it is not sent to the server, so it is in no request or log), and the link needs no account
 * and nothing stored. The inputs are JSON, as UTF-8, in URL-safe base64 without padding.
 */
export const SHARE_PREFIX = 'share=';

/** The payload's version: a later format can still read, or refuse, older links. */
const VERSION = 1;

const KINDS: readonly SavedCalculationKind[] = ['Purchase', 'HomeComparison', 'Refinance', 'Strategy'];

/** What a share link opens: a page's kind, and its request. */
export interface SharedInputs {
  kind: SavedCalculationKind;
  request: unknown;
}

/** The URL fragment that shares a page's request, e.g. "share=eyJ2Ijox…". */
export function shareFragment(kind: SavedCalculationKind, request: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: VERSION, kind, request }));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return SHARE_PREFIX + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * What a URL fragment shares: null when it is not a share link, 'broken' when it is one that cannot be read (cut
 * short, edited, or from a later version). The request is only checked to be an object (a comparison's, one with one
 * to four homes): the form shows what is wrong with its values, and the API checks them all.
 */
export function readShareLink(fragment: string | null): SharedInputs | 'broken' | null {
  if (!fragment?.startsWith(SHARE_PREFIX)) return null;
  try {
    const base64 = fragment.slice(SHARE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!isObject(payload) || payload['v'] !== VERSION) return 'broken';
    const { kind, request } = payload;
    if (!KINDS.includes(kind as SavedCalculationKind) || !isObject(request)) return 'broken';
    if (kind === 'HomeComparison') {
      const homes = request['homes'];
      if (!Array.isArray(homes) || homes.length < 1 || homes.length > 4 || !homes.every(isObject)) return 'broken';
    }
    return { kind: kind as SavedCalculationKind, request };
  } catch {
    return 'broken';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
