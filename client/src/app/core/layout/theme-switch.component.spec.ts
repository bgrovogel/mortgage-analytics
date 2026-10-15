import { TestBed } from '@angular/core/testing';
import { ThemeSwitchComponent } from './theme-switch.component';

describe('ThemeSwitchComponent', () => {
  const root = document.documentElement;

  afterEach(() => {
    delete root.dataset['theme'];
    localStorage.clear();
  });

  const render = () => {
    const fixture = TestBed.createComponent(ThemeSwitchComponent);
    fixture.detectChanges();
    const buttons = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')];
    const named = (label: string) => buttons().find((b) => b.textContent!.trim() === label)!;
    const press = (label: string) => {
      named(label).click();
      fixture.detectChanges();
    };
    return { buttons, named, press };
  };

  it('offers the system, light and dark, with the system pressed until a choice is made', () => {
    const { buttons } = render();

    expect(buttons().map((b) => [b.textContent!.trim(), b.getAttribute('aria-pressed')])).toEqual([
      ['System', 'true'], ['Light', 'false'], ['Dark', 'false'],
    ]);
  });

  it('puts the page in the theme chosen, and remembers it', () => {
    const { named, press } = render();

    press('Dark');

    expect(root.dataset['theme']).toBe('dark');
    expect(named('Dark').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('starts from the remembered choice', () => {
    localStorage.setItem('theme', 'light');

    const { named } = render();

    expect(named('Light').getAttribute('aria-pressed')).toBe('true');
  });

  it('goes back to the system when asked', () => {
    const { press } = render();
    press('Light');

    press('System');

    expect(root.dataset['theme']).toBeUndefined();
  });
});
