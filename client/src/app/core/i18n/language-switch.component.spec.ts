import { TestBed } from '@angular/core/testing';
import { chooseLanguage, currentLanguage } from './i18n';
import { LanguageSwitchComponent } from './language-switch.component';

describe('LanguageSwitchComponent', () => {
  afterEach(() => chooseLanguage('en'));

  const render = () => {
    const fixture = TestBed.createComponent(LanguageSwitchComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, button: (code: string) => root.querySelector(`[data-testid="language-${code}"]`) as HTMLButtonElement };
  };

  it('offers each language by its own name, English marked as the one in use', () => {
    const { button } = render();

    expect(button('en').getAttribute('aria-label')).toBe('EN English');
    expect(button('es').getAttribute('aria-label')).toBe('ES Español');
    expect(button('en').getAttribute('aria-pressed')).toBe('true');
    expect(button('es').getAttribute('aria-pressed')).toBe('false');
  });

  it('marks each button with its own language, so a screen reader says its name right', () => {
    const { button } = render();

    expect([button('en').lang, button('es').lang]).toEqual(['en', 'es']);
  });

  it('is named, as a group, in the language of the page', async () => {
    const { fixture, root } = render();
    const group = () => root.querySelector('[role="group"]')!.getAttribute('aria-label');
    expect(group()).toBe('Language');

    await chooseLanguage('es');
    fixture.detectChanges();

    expect(group()).toBe('Idioma');
  });

  it('switches the page with one press, and shows which is in use', async () => {
    const { fixture, button } = render();

    button('es').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(currentLanguage()).toBe('es');
    expect(button('es').getAttribute('aria-pressed')).toBe('true');
    expect(button('en').getAttribute('aria-pressed')).toBe('false');
  });

  it('has both a full and a short name on each button, for a wide screen and a phone', () => {
    const { button } = render();

    expect([...button('es').querySelectorAll('span')].map((s) => s.textContent!.trim())).toEqual(['Español', 'ES']);
  });
});
