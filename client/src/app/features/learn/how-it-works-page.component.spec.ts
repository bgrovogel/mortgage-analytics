import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HowItWorksPageComponent } from './how-it-works-page.component';

describe('HowItWorksPageComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = () => {
    const fixture = TestBed.createComponent(HowItWorksPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('explains each thing the app works out, under a heading, in the order a buyer meets them', () => {
    const headings = [...render().querySelectorAll('article h3')].map((h) => h.textContent!.trim());

    expect(headings).toEqual([
      'Your monthly payment', 'Taxes and insurance', 'Mortgage insurance', 'Cash to close', 'The APR',
      'What you can afford', 'Rent or buy', 'Refinancing', 'Pay off or invest',
    ]);
  });

  it('works the payment through with the example loan', () => {
    const text = render().querySelector('#payment')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('$2,325.26');
    expect(text).toContain('payment = P × i ÷ (1 − (1 + i)^−n)');
  });

  it('names the sources behind the rules', () => {
    const text = render().querySelector('[data-testid="sources"]')!.textContent!;

    for (const source of ['Fannie Mae', 'HUD Handbook 4000.1', '38 CFR 36.4340', 'Regulation Z', 'Texas Tax Code']) {
      expect(text).toContain(source);
    }
  });

  it('says how the numbers are checked, and links to the glossary', () => {
    const root = render();

    expect(root.querySelector('[data-testid="checked"]')?.textContent).toContain('separate model');
    expect(root.querySelector('a[href="/glossary"]')).not.toBeNull();
  });
});
