import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ES } from './es';

const ROOT = join(__dirname, '..', '..');

/** Every source file of the app that can hold a message: components, services, templates; not specs or the translations themselves. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === join(ROOT, 'core', 'i18n', 'es') ? [] : sources(path);
    return (path.endsWith('.ts') && !path.endsWith('.spec.ts')) || path.endsWith('.html') ? [path] : [];
  });
}

// A string literal: single- or double-quoted, with no backslash in it (a message never needs one; see core/i18n/i18n.ts).
const LITERAL = String.raw`(['"])((?:(?!\1)[^\\\n])*)\1`;
const PIPED = new RegExp(`${LITERAL}\\s*\\|\\s*t\\b`, 'g');
const CALLED = new RegExp(String.raw`\b(?:t|msg)\(\s*${LITERAL}`, 'g');
const PLURAL = new RegExp(String.raw`\btp\(\s*[^,'"\`()]+,\s*${LITERAL}\s*,\s*${LITERAL}`, 'g');
const NOT_LITERAL = /\b(?:t|msg)\(\s*`/g;

interface Found {
  key: string;
  file: string;
}

function found(): { keys: Found[]; backticked: string[] } {
  const keys: Found[] = [];
  const backticked: string[] = [];
  for (const path of sources(ROOT)) {
    const text = readFileSync(path, 'utf8');
    const file = relative(ROOT, path).replace(/\\/g, '/');
    const add = (raw: string) => keys.push({ key: raw.replace(/&quot;/g, '"'), file });
    for (const m of text.matchAll(PIPED)) add(m[2]);
    for (const m of text.matchAll(CALLED)) add(m[2]);
    for (const m of text.matchAll(PLURAL)) {
      add(m[2]);
      add(m[4]);
    }
    if (NOT_LITERAL.test(text)) backticked.push(file);
    NOT_LITERAL.lastIndex = 0;
  }
  return { keys, backticked };
}

/** The placeholders of a message, e.g. "{0}", "{n}": the translation must keep exactly these. */
const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Spanish translations', () => {
  const { keys, backticked } = found();
  const used = new Set(keys.map((k) => k.key));

  it('finds the messages in the source (a sanity check on this test)', () => {
    expect(used.size).toBeGreaterThan(500);
  });

  it('keeps every message a plain string literal, so it can be found', () => {
    expect(backticked).toEqual([]);
  });

  it('has a translation for every message', () => {
    const missing = [...used].filter((key) => !ES[key]).sort();
    expect(missing).toEqual([]);
  });

  it('keeps each message\'s placeholders', () => {
    const wrong = [...used].filter((key) => ES[key] && placeholders(key).join() !== placeholders(ES[key]).join()).sort();
    expect(wrong).toEqual([]);
  });

  it('has no translation for a message that is no longer used', () => {
    const stale = Object.keys(ES).filter((key) => !used.has(key)).sort();
    expect(stale).toEqual([]);
  });
});
