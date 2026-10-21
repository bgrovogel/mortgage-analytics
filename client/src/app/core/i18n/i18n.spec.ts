import { chooseLanguage, currentLanguage, initialLanguage, startLanguage, t, tp } from './i18n';

describe('the page’s language', () => {
  afterEach(async () => {
    await chooseLanguage('en');
    localStorage.clear();
  });

  const windowWith = (stored: string | null, languages: string[]) => ({
    localStorage: { getItem: () => stored } as unknown as Storage,
    navigator: { languages, language: languages[0] } as unknown as Navigator,
  });

  describe('starting', () => {
    it('is the language chosen before', () => {
      expect(initialLanguage(windowWith('es', ['en-US']))).toBe('es');
      expect(initialLanguage(windowWith('en', ['es-MX']))).toBe('en');
    });

    it('is Spanish for a browser that prefers it, and English otherwise', () => {
      expect(initialLanguage(windowWith(null, ['es-US', 'en-US']))).toBe('es');
      expect(initialLanguage(windowWith(null, ['es']))).toBe('es');
      expect(initialLanguage(windowWith(null, ['en-US', 'es']))).toBe('en');
      expect(initialLanguage(windowWith(null, ['fr-FR']))).toBe('en');
      expect(initialLanguage(windowWith(null, []))).toBe('en');
    });

    it('ignores a stored value that is no language of ours', () => {
      expect(initialLanguage(windowWith('klingon', ['en-US']))).toBe('en');
    });

    it('is English when storage is blocked and the browser says nothing', () => {
      const blocked = { localStorage: { getItem: () => { throw new Error('blocked'); } } as unknown as Storage, navigator: {} as unknown as Navigator };

      expect(initialLanguage(blocked)).toBe('en');
    });

    it('starts the page in the language it would choose, with its translations loaded', async () => {
      localStorage.setItem('language', 'es');

      await startLanguage();

      expect(currentLanguage()).toBe('es');
      expect(t('Language')).toBe('Idioma');
    });
  });

  describe('choosing', () => {
    it('shows English as written, and Spanish from the table, and goes back', async () => {
      expect(t('Language')).toBe('Language');

      await chooseLanguage('es');
      expect(t('Language')).toBe('Idioma');

      await chooseLanguage('en');
      expect(t('Language')).toBe('Language');
    });

    it('tells the document its language, and remembers the choice', async () => {
      await chooseLanguage('es');

      expect(document.documentElement.lang).toBe('es');
      expect(localStorage.getItem('language')).toBe('es');
    });

    it('still works when the choice cannot be remembered', async () => {
      const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });

      await chooseLanguage('es');

      expect(currentLanguage()).toBe('es');
      spy.mockRestore();
    });

    it('shows a message with no translation as it was written, rather than nothing', async () => {
      await chooseLanguage('es');

      expect(t('A message nobody has translated yet')).toBe('A message nobody has translated yet');
    });
  });

  describe('messages with values', () => {
    it('fills {0}, {1} and {name} with the values given, and leaves a placeholder with no value', () => {
      expect(t('Signed in as {0}', ['a@b.c'])).toBe('Signed in as a@b.c');
      expect(t('{0} of {1}', [3, 12])).toBe('3 of 12');
      expect(t('Hello {name}', { name: 'Ana' })).toBe('Hello Ana');
      expect(t('Nothing for {missing}', { other: 1 })).toBe('Nothing for {missing}');
    });

    it('chooses between one and other by the count, with the count as {n}', () => {
      expect(tp(1, '{n} year', '{n} years')).toBe('1 year');
      expect(tp(0, '{n} year', '{n} years')).toBe('0 years');
      expect(tp(7, '{n} year', '{n} years')).toBe('7 years');
      expect(tp(2, 'a {kind} year', '{n} {kind} years', { kind: 'leap' })).toBe('2 leap years');
    });
  });
});
