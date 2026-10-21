import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TermsPageComponent } from './terms-page.component';

describe('TermsPageComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = () => {
    const fixture = TestBed.createComponent(TermsPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('answers what the numbers are, whose advice they are not, how exact they are, and what no one promises', () => {
    const headings = [...render().querySelectorAll('article h3')].map((h) => h.textContent!.trim());

    expect(headings).toEqual(['What this is', 'What it is not', 'How exact it is', 'No promises', 'Your numbers and your account']);
  });

  it('says plainly that it is an estimate, not a loan offer, a Loan Estimate or a pre-approval', () => {
    const text = render().querySelector('#what')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('estimate');
    expect(text).toContain('not a loan offer');
    expect(text).toContain('Loan Estimate');
    expect(text).toContain('pre-approval');
  });

  it('says it is not financial, tax or legal advice, and who to ask', () => {
    const text = render().querySelector('#advice')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('not financial, tax or legal advice');
    expect(text).toContain('lender');
    expect(text).toContain('tax professional');
  });

  it('says which year the rules are for, and that your lender figures can differ', () => {
    const text = render().querySelector('#exact')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('2026');
    expect(text).toContain('lender');
  });

  it('says it is provided as it is, a demonstration, with no promise it is right for a decision', () => {
    const text = render().querySelector('#promises')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('demonstration');
    expect(text).toContain('as it is');
  });

  it('points to the privacy page for what happens to numbers and accounts', () => {
    const link = render().querySelector('#privacy a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/privacy');
  });
});
