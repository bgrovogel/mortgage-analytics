import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StartPageComponent } from './start-page.component';

describe('StartPageComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = () => {
    const fixture = TestBed.createComponent(StartPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('asks what the visitor wants to figure out', () => {
    expect(render().querySelector('h2')?.textContent?.trim()).toBe('What do you want to figure out?');
  });

  it('offers each question, each leading to the page that answers it', () => {
    const cards = [...render().querySelectorAll<HTMLAnchorElement>('[data-testid="start-questions"] a')];

    expect(cards.map((a) => [a.querySelector('h3')?.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['What will this home cost?', '/calculator/overview'],
      ['Can I afford it?', '/calculator/affordability'],
      ['Should I rent or buy?', '/calculator/rent-or-buy'],
      ['Which home is better?', '/compare'],
      ['Should I refinance?', '/refinance'],
      ['Pay off the mortgage, or invest?', '/strategy'],
    ]);
  });

  it('says what it asks for, and what it keeps', () => {
    const text = render().querySelector('[data-testid="start-promises"]')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('No account needed');
    expect(text).toContain('Nothing is saved unless you choose to save it');
  });
});
