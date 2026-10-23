import { TestBed } from '@angular/core/testing';
import { FirstVisitHintsComponent, HINTS_STORAGE_KEY } from './first-visit-hints.component';

describe('FirstVisitHintsComponent', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  const render = () => {
    const fixture = TestBed.createComponent(FirstVisitHintsComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('says on a first visit where the numbers, the answer and the views are', () => {
    const { root } = render();

    expect([...root.querySelectorAll('li')].map((li) => li.querySelector('strong')!.textContent)).toEqual(['Your numbers', 'The answer', 'The views']);
    expect(root.querySelector('[data-testid="first-visit"]')).not.toBeNull();
  });

  it('does not say where the form is: on a phone it is behind a button, not on the left', () => {
    const { root } = render();

    expect(root.querySelector('[data-testid="first-visit"]')!.textContent).not.toMatch(/\b(left|right|above|below)\b/);
  });

  it('is dismissed for good with one tap', () => {
    const { fixture, root } = render();

    root.querySelector<HTMLButtonElement>('[data-testid="dismiss-hints"]')!.click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="first-visit"]')).toBeNull();
    expect(render().root.querySelector('[data-testid="first-visit"]')).toBeNull(); // the next visit
    expect(localStorage.getItem(HINTS_STORAGE_KEY)).toBe('1');
  });

  it('is shown again, not an error, where storage is blocked', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const { fixture, root } = render();
    expect(root.querySelector('[data-testid="first-visit"]')).not.toBeNull();

    expect(() => {
      root.querySelector<HTMLButtonElement>('[data-testid="dismiss-hints"]')!.click();
      fixture.detectChanges();
    }).not.toThrow();
    expect(root.querySelector('[data-testid="first-visit"]')).toBeNull(); // gone for this visit
  });
});
