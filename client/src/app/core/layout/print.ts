/** The event the page sends when its theme changes for printing, so charts can redraw in the new colours. */
export const THEME_CHANGE = 'themechange';

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
