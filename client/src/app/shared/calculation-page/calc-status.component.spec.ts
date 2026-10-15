import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CalcStatusComponent } from './calc-status.component';

describe('CalcStatusComponent', () => {
  const busy = signal(false);
  const errors = signal<string[]>([]);
  const result = signal<unknown>(null);
  const retry = jest.fn();
  const store = { busy, errors, result, retry } as never;

  beforeEach(() => {
    jest.useFakeTimers();
    busy.set(false);
    errors.set([]);
    result.set(null);
    retry.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  const render = () => {
    const fixture = TestBed.createComponent(CalcStatusComponent);
    fixture.componentRef.setInput('store', store);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const state = () => root.querySelector('[data-testid="calc-status"]')?.getAttribute('data-state') ?? null;
    const text = () => root.querySelector('[data-testid="calc-status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
    return { fixture, root, state, text };
  };

  it('says nothing before there is a result to be up to date with', () => {
    const { state } = render();

    expect(state()).toBeNull();
  });

  it('says the result is up to date', () => {
    result.set({});
    const { state, text } = render();

    expect([state(), text()]).toEqual(['ok', 'Up to date']);
  });

  it('says it is calculating only after 300ms, so a quick answer does not flicker', () => {
    result.set({});
    const { fixture, state } = render();

    busy.set(true);
    fixture.detectChanges();
    jest.advanceTimersByTime(299);
    fixture.detectChanges();
    expect(state()).toBe('ok');

    jest.advanceTimersByTime(2);
    fixture.detectChanges();
    expect(state()).toBe('busy');

    busy.set(false);
    fixture.detectChanges();
    expect(state()).toBe('ok');
  });

  it('says it could not calculate, and offers to try again', () => {
    result.set({});
    errors.set(['We could not run that calculation.']);
    const { root, state, text } = render();

    expect([state(), text()]).toEqual(['error', "Couldn't calculate · Retry"]);
    (root.querySelector('[data-testid="calc-status-retry"]') as HTMLButtonElement).click();
    expect(retry).toHaveBeenCalled();
  });

  it('says the last result is kept while offline', () => {
    result.set({});
    const { fixture, state, text } = render();

    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    expect([state(), text()]).toEqual(['offline', 'Offline · last result kept']);
    window.dispatchEvent(new Event('online'));
    fixture.detectChanges();
    expect(state()).toBe('ok');
  });
});
