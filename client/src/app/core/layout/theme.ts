import { THEME_CHANGE } from './print';

/** What a visitor chooses: the colours of their system, or light or dark whatever it uses. */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_CHOICES: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Where the choice is remembered, per browser. */
export const THEME_STORAGE_KEY = 'theme';

/** The saved choice, or the system's. Storage can be blocked (private windows, settings), so failures fall back. */
export function loadTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_CHOICES.some((c) => c.value === saved) ? (saved as ThemeChoice) : 'system';
  } catch {
    return 'system';
  }
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Not remembered next visit; this one still has it.
  }
}

/**
 * Puts the page in the chosen theme (styles.scss keys its colours on `data-theme`; with none, the system's
 * `prefers-color-scheme` decides) and tells the charts to redraw in its colours.
 */
export function applyTheme(win: Window, choice: ThemeChoice): void {
  const root = win.document.documentElement;
  if (choice === 'system') delete root.dataset['theme'];
  else root.dataset['theme'] = choice;
  win.dispatchEvent(new Event(THEME_CHANGE));
}
