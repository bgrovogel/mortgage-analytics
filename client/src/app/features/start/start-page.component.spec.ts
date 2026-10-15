import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { StartPageComponent } from './start-page.component';

describe('StartPageComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = (data: Record<string, unknown> = {}) => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { data } } });
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
      ['How much house can I afford?', '/calculator/affordability'],
      ['Should I rent or buy?', '/calculator/rent-or-buy'],
      ['Which home is better?', '/compare'],
      ['Should I refinance?', '/refinance'],
      ['Pay off the mortgage, or invest?', '/strategy'],
    ]);
  });

  it('shows what each question comes to on the example numbers', () => {
    const examples = [...render().querySelectorAll('[data-testid="start-questions"] .example')].map((e) => e.textContent!.trim());

    expect(examples).toEqual([
      'With the example: $3,102 a month',
      'With the example: up to $474,091 comfortably, on $150,000 of income',
      'With the example: buying wins after 4 years, against $2,700 rent',
      'With the example: the same home from two lenders, side by side',
      'With the example: saves $14,067 and breaks even in Jul 2029',
      'With the example: investing is $134,597 ahead at 8%',
    ]);
  });

  it('says plainly when an address is not a page, and still offers the questions', () => {
    const root = render({ notFound: true });

    expect(root.querySelector('[data-testid="not-found"]')?.textContent).toContain('That address is not a page here');
    expect(root.querySelectorAll('[data-testid="start-questions"] a')).toHaveLength(6);
  });

  it('says nothing of a missing page on the home page', () => {
    expect(render().querySelector('[data-testid="not-found"]')).toBeNull();
  });

  it('says what it asks for, and what it keeps', () => {
    const text = render().querySelector('[data-testid="start-promises"]')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('No account needed');
    expect(text).toContain('Nothing is saved unless you choose to save it');
  });
});
