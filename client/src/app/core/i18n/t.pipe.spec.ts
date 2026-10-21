import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { chooseLanguage } from './i18n';
import { TPipe } from './t.pipe';

@Component({
  imports: [TPipe],
  template: `<p data-testid="plain">{{ 'Language' | t }}</p><p data-testid="values">{{ 'Signed in as {0}' | t: [email] }}</p>`,
})
class HostComponent {
  email = 'a@b.c';
}

describe('TPipe', () => {
  afterEach(() => chooseLanguage('en'));

  it('writes a message in the page’s language, and again when the language changes, with no other change', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const plain = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="plain"]')!.textContent;

    expect(plain()).toBe('Language');

    await chooseLanguage('es');
    fixture.detectChanges();

    expect(plain()).toBe('Idioma');
  });

  it('fills in the values given', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="values"]')!.textContent).toBe('Signed in as a@b.c');
  });
});
