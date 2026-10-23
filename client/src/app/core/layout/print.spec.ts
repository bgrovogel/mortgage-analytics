import { THEME_CHANGE, printInLightTheme, printShortSummary } from './print';

describe('printShortSummary', () => {
  const root = document.documentElement;
  afterEach(() => {
    window.dispatchEvent(new Event('afterprint'));
    delete root.dataset['print'];
  });

  it('prints in short mode, which is on while the dialog is open, and off after', () => {
    let during: string | undefined;
    const print = jest.spyOn(window, 'print').mockImplementation(() => { during = root.dataset['print']; });

    printShortSummary(window);

    expect(print).toHaveBeenCalledTimes(1);
    expect(during).toBe('short');
    expect(root.dataset['print']).toBe('short');

    window.dispatchEvent(new Event('afterprint'));

    expect(root.dataset['print']).toBeUndefined();
    print.mockRestore();
  });

  it('goes back to a normal printout if printing fails', () => {
    const print = jest.spyOn(window, 'print').mockImplementation(() => { throw new Error('blocked'); });

    expect(() => printShortSummary(window)).toThrow('blocked');

    expect(root.dataset['print']).toBeUndefined();
    print.mockRestore();
  });
});

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

  it('changes nothing when the browser says it has printed without saying it would', () => {
    root.dataset['theme'] = 'dark';

    window.dispatchEvent(new Event('afterprint'));

    expect(root.dataset['theme']).toBe('dark');
    expect(changes).toBe(0);
  });

  it('prints in the light theme every time', () => {
    for (const time of [1, 2]) {
      window.dispatchEvent(new Event('beforeprint'));
      expect(root.dataset['theme']).toBe('light');
      window.dispatchEvent(new Event('afterprint'));
      expect(root.dataset['theme']).toBeUndefined();
      expect(changes).toBe(time * 2);
    }
  });

  it('stops listening for both, even mid-print', () => {
    window.dispatchEvent(new Event('beforeprint'));
    stop();
    window.dispatchEvent(new Event('afterprint'));

    expect(root.dataset['theme']).toBe('light'); // left as it was when stopped
  });

  it('stops when asked', () => {
    stop();
    window.dispatchEvent(new Event('beforeprint'));

    expect(root.dataset['theme']).toBeUndefined();
  });
});
