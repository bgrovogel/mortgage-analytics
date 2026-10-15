import { THEME_CHANGE, printInLightTheme } from './print';

describe('printInLightTheme', () => {
  const root = document.documentElement;
  let changes: number;
  const count = () => changes++;
  let stop: () => void;

  beforeEach(() => {
    changes = 0;
    window.addEventListener(THEME_CHANGE, count);
    stop = printInLightTheme(window);
  });
  afterEach(() => {
    stop();
    window.removeEventListener(THEME_CHANGE, count);
    delete root.dataset['theme'];
  });

  it('prints in the light theme, whatever the screen uses, and goes back after', () => {
    window.dispatchEvent(new Event('beforeprint'));
    expect(root.dataset['theme']).toBe('light');
    expect(changes).toBe(1);

    window.dispatchEvent(new Event('afterprint'));
    expect(root.dataset['theme']).toBeUndefined();
    expect(changes).toBe(2);
  });

  it('keeps a theme the page had chosen', () => {
    root.dataset['theme'] = 'dark';

    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));

    expect(root.dataset['theme']).toBe('dark');
  });

  it('goes back to the screen’s theme even when the browser says it is printing twice', () => {
    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));

    expect(root.dataset['theme']).toBeUndefined();
  });

  it('stops when asked', () => {
    stop();
    window.dispatchEvent(new Event('beforeprint'));

    expect(root.dataset['theme']).toBeUndefined();
  });
});
