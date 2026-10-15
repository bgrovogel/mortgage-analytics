import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GLOSSARY, glossaryAnchor } from './glossary';
import { TermComponent } from './term.component';

@Component({
  imports: [TermComponent],
  template: `<p data-testid="line">Your <app-term of="PMI">mortgage insurance</app-term> and <app-term of="Nothing">nothing</app-term>.</p>`,
})
class HostComponent {}

describe('TermComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('links the words it wraps to the term on the glossary page, and says the meaning on hover', () => {
    const link = render().querySelector('a.term') as HTMLAnchorElement;
    const meaning = GLOSSARY.find((e) => e.term === 'PMI')!.meaning;

    expect(link.textContent!.trim()).toBe('mortgage insurance');
    expect(link.getAttribute('href')).toBe('/glossary#term-pmi');
    expect(link.title).toBe(meaning);
  });

  it('leaves the words as they are when the glossary has no such term', () => {
    const line = render().querySelector('[data-testid="line"]') as HTMLElement;

    expect(line.querySelectorAll('a.term')).toHaveLength(1); // only the PMI one
    expect(line.textContent!.replace(/\s+/g, ' ').trim()).toBe('Your mortgage insurance and nothing.');
  });

  it('names an anchor for a multi-word term the way the glossary page does', () => {
    expect(glossaryAnchor('Loan-to-value')).toBe('term-loan-to-value');
    expect(glossaryAnchor('Down payment')).toBe('term-down-payment');
  });
});
