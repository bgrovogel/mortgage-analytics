import { THEME_CHANGE } from './print';
import { THEME_STORAGE_KEY, applyTheme, loadTheme, saveTheme } from './theme';

describe('the theme choice', () => {
  const root = document.documentElement;

  afterEach(() => {
    jest.restoreAllMocks();
    delete root.dataset['theme'];
    localStorage.clear();
  });

  describe('loadTheme', () => {
    it('follows the system until a choice has been made', () => {
      expect(loadTheme()).toBe('system');
    });

    it('returns the choice that was saved', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');

      expect(loadTheme()).toBe('dark');
    });

    it('follows the system when what was saved is not a choice', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'purple');

      expect(loadTheme()).toBe('system');
    });

    it('follows the system when storage is blocked', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });

      expect(loadTheme()).toBe('system');
    });
  });

  describe('applyTheme', () => {
    it('sets the page to the theme chosen, and tells the charts to redraw', () => {
      let changes = 0;
      const count = () => changes++;
      window.addEventListener(THEME_CHANGE, count);

      applyTheme(window, 'dark');

      expect(root.dataset['theme']).toBe('dark');
      expect(changes).toBe(1);
      window.removeEventListener(THEME_CHANGE, count);
    });

    it('leaves the system to decide when asked to follow it', () => {
      root.dataset['theme'] = 'light';

      applyTheme(window, 'system');

      expect(root.dataset['theme']).toBeUndefined();
    });
  });

  describe('saveTheme', () => {
    it('keeps the choice for the next visit', () => {
      saveTheme('light');

      expect(loadTheme()).toBe('light');
    });

    it('carries on when storage is blocked', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });

      expect(() => saveTheme('dark')).not.toThrow();
    });
  });
});
