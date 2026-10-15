import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GLOSSARY } from '../../core/glossary/glossary';
import { GlossaryPageComponent } from './glossary-page.component';

describe('GlossaryPageComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = () => {
    const fixture = TestBed.createComponent(GlossaryPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('keeps its terms in alphabetical order, each once', () => {
    const terms = GLOSSARY.map((entry) => entry.term);

    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b)));
    expect(new Set(terms).size).toBe(terms.length);
  });

  it('defines every term in a sentence of its own, and none is empty', () => {
    for (const { term, meaning } of GLOSSARY) {
      expect(meaning.length).toBeGreaterThan(30);
      expect(term.trim()).toBe(term);
    }
  });

  it('lists each term with an anchor of its own, so a link can land on it', () => {
    const root = render();

    expect(root.querySelector('#term-pmi dt, #term-pmi')?.textContent).toContain('PMI');
    expect(root.querySelectorAll('dt').length).toBe(GLOSSARY.length);
  });

  it('covers the terms the app uses without saying what they are', () => {
    const terms = GLOSSARY.map((entry) => entry.term);

    for (const term of ['APR', 'Escrow', 'PMI', 'MIP', 'Points', 'Buydown', 'Debt-to-income', 'Loan-to-value', 'Recast', 'Homestead']) {
      expect(terms).toContain(term);
    }
  });
});
