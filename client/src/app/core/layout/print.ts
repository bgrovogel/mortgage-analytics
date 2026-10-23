/** The event the page sends when its theme changes for printing, so charts can redraw in the new colours. */
export const THEME_CHANGE = 'themechange';

/**
 * Prints the page as a short summary: the headline figures and the lines that answer, without the tables and charts
 * (styles.scss keys on `data-print="short"`). It is on while the print dialog is open and off when the browser says
 * it has printed, so the next printout is a full one again.
 */
export function printShortSummary(win: Window): void {
  const root = win.document.documentElement;
  const off = () => {
    delete root.dataset['print'];
    win.removeEventListener('afterprint', off);
  };
  root.dataset['print'] = 'short';
  win.addEventListener('afterprint', off);
  try {
    win.print();
  } catch (error) {
    off();
    throw error;
  }
}

/**
 * Prints in the light theme whatever the screen uses: dark pages waste ink and print poorly. Before printing (the
 * Print button, or the browser's own) the page switches to light, and charts redraw in its colours; after, it goes
 * back. Returns a function that stops it.
 */
export function printInLightTheme(win: Window): () => void {
  const root = win.document.documentElement;
  // The screen's theme while printing; a browser can say it is printing twice before it is done.
  let printing = false;
  let before: string | undefined;
  const changed = () => win.dispatchEvent(new Event(THEME_CHANGE));
  const toLight = () => {
    if (printing) return;
    printing = true;
    before = root.dataset['theme'];
    root.dataset['theme'] = 'light';
    changed();
  };
  const back = () => {
    if (!printing) return;
    printing = false;
    if (before === undefined) delete root.dataset['theme'];
    else root.dataset['theme'] = before;
    changed();
  };
  win.addEventListener('beforeprint', toLight);
  win.addEventListener('afterprint', back);
  return () => {
    win.removeEventListener('beforeprint', toLight);
    win.removeEventListener('afterprint', back);
  };
}
