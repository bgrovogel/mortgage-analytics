import { signal } from '@angular/core';

/** The languages the app is in. The first is the one the text is written in; the rest are translations of it. */
export type Language = 'en' | 'es';

/** Each language by the name its own speakers use, which is how the switch names it. */
export const LANGUAGES: readonly { code: Language; name: string; short: string }[] = [
  { code: 'en', name: 'English', short: 'EN' },
  { code: 'es', name: 'Español', short: 'ES' },
];

const STORAGE_KEY = 'language';

/** A translation for each message in English, as the app's own text is written: the message is its own key. */
type Dictionary = Readonly<Record<string, string>>;

const language = signal<Language>('en');
const dictionary = signal<Dictionary | null>(null);

/** The language the page is in now, as a signal: whatever reads it (a template, a computed) is redone when it changes. */
export const currentLanguage = language.asReadonly();

/** The values a message's {0}, {1} (or {name}) stand for. */
export type MessageParams = readonly (string | number)[] | Readonly<Record<string, string | number>>;

/** Fills a message's {0}, {1} or {name} with the values given; a placeholder with no value is left as it is. */
function fill(message: string, params: MessageParams): string {
  const values = params as Readonly<Record<string, string | number>>;
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => (key in values ? String(values[key]) : placeholder));
}

/**
 * The text in the page's language. The message is written in English, with {0} or {name} where a value goes, and is its own
 * key into the translations; a message with no translation (or any message in English) is shown as written. Reads the
 * language signal, so a computed or template that calls this is redone when the language changes.
 */
export function t(message: string, params?: MessageParams): string {
  const translated = language() === 'en' ? message : (dictionary()?.[message] ?? message);
  return params ? fill(translated, params) : translated;
}

/**
 * A message that depends on a count: `one` for exactly 1 and `other` for anything else, each translated on its own, with
 * the count as {n}. Both English and Spanish use "one" for 1 only.
 */
export function tp(count: number, one: string, other: string, params: Readonly<Record<string, string | number>> = {}): string {
  return t(count === 1 ? one : other, { ...params, n: count });
}

/** The language a visitor starts in: the one they chose before, else Spanish if their browser prefers it, else English. */
export function initialLanguage(win: Pick<Window, 'localStorage' | 'navigator'>): Language {
  try {
    const stored = win.localStorage.getItem(STORAGE_KEY);
    if (LANGUAGES.some((l) => l.code === stored)) return stored as Language;
  } catch {
    // Storage can be blocked; the browser's own language still says what to start in.
  }
  const preferred = win.navigator.languages?.[0] ?? win.navigator.language ?? '';
  return /^es\b/i.test(preferred) ? 'es' : 'en';
}

/**
 * Switches the page to a language: loads its translations first if they are not here yet (so the page never shows a
 * half-translated moment), tells the document, and remembers the choice for the next visit.
 */
export async function chooseLanguage(code: Language, win: Window = window): Promise<void> {
  if (code !== 'en' && !dictionary()) dictionary.set((await import('./es')).ES);
  language.set(code);
  win.document.documentElement.lang = code;
  try {
    win.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // The page is in the language chosen for this visit all the same.
  }
}

/** Starts the page in its language, before anything is drawn, so there is no flash of English. */
export async function startLanguage(win: Window = window): Promise<void> {
  const code = initialLanguage(win);
  await chooseLanguage(code, win);
}
