import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { aResponse } from '../../../testing/builders';
import { routes } from '../../app.routes';
import { AuthService } from '../../core/auth/auth.service';
import { AmortizationRequest, AmortizationResponse } from '../../core/models/amortization.models';
import { AmortizationApiService } from '../../core/services/amortization-api.service';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { CalculatorStore, RECALCULATE_DELAY_MS } from '../calculator/calculator.store';
import { ComparisonStore } from './comparison.store';

/** Compare homes: Home A is the calculator's loan, and the switch edits any of up to four. */
describe('ComparePageComponent', () => {
  let harness: RouterTestingHarness;
  let calculate: jest.Mock<Observable<AmortizationResponse>, [AmortizationRequest]>;

  beforeEach(() => {
    jest.useFakeTimers();
    calculate = jest.fn().mockReturnValue(of(aResponse()));
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: SavedCalculationsApiService, useValue: {} }, { provide: AuthService, useValue: { user: signal(null) } }, { provide: AmortizationApiService, useValue: { calculate } }],
    });
  });
  afterEach(() => jest.useRealTimers());

  /** Opens a URL, then lets the form's first calculation through the debounce. */
  const open = async (url: string) => {
    harness = await RouterTestingHarness.create(url);
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    harness.detectChanges();
  };
  const el = (selector: string) => harness.routeNativeElement!.querySelector(selector) as HTMLElement | null;

    const switchTo = (house: 'a' | 'b' | 'c' | 'd') => {
    el(`[data-testid="edit-home-${house}"]`)!.dispatchEvent(new Event('change'));
    harness.detectChanges();
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    harness.detectChanges();
  };
  const homePrice = () => el('[data-testid="home-price"]') as HTMLInputElement;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    harness.detectChanges();
  };

  it('shows a switch between the homes, editing Home A first, and starts Home B as a copy of it', async () => {
    await open('/compare');
    const comparison = TestBed.inject(ComparisonStore);

    expect(el('[data-testid="house-switch"]')).not.toBeNull();
    expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home A');
    expect(comparison.request()!.homes).toEqual([comparison.request()!.homes[0], comparison.request()!.homes[0]]);
  });

  it('edits Home B in the same place, leaving Home A as it was, and only Home A is the shared loan', async () => {
    await open('/compare');
    const first = TestBed.inject(CalculatorStore).request();

    switchTo('b');
    expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home B');
    expect(el('[data-testid="shared-tag"]')).toBeNull();
    type(homePrice(), '450000');

    const comparison = TestBed.inject(ComparisonStore).request()!;
    expect(comparison.homes[1].homePrice).toBe(450_000);
    expect(comparison.homes[0]).toBe(first);
    expect(TestBed.inject(CalculatorStore).request()).toBe(first);

    switchTo('a');
    expect(homePrice().value).toBe(first!.homePrice.toLocaleString('en-US'));
  });

  it('adds homes up to four, each a copy of Home A to edit, then offers no more', async () => {
    await open('/compare');
    const click = (id: string) => {
    (el(`[data-testid="${id}"]`) as HTMLButtonElement).click();
    harness.detectChanges();
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    harness.detectChanges();
    };

    click('add-home');
    expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home C');
    type(homePrice(), '380000');
    click('add-home');

    const comparison = TestBed.inject(ComparisonStore).request()!;
    expect(comparison.homes.map((h) => h.homePrice)).toEqual([415_000, 415_000, 380_000, 415_000]);
    expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home D');
    expect(el('[data-testid="edit-home-d"]')).not.toBeNull();
    expect(el('[data-testid="add-home"]')).toBeNull();
    expect(el('[data-testid="editing-note"]')!.textContent!.trim()).toBe('Editing Home D · 4 of 4 homes');
  });

  it('removes the home being edited, never Home A, and keeps at least two', async () => {
    await open('/compare');
    expect(el('[data-testid="remove-home"]')).toBeNull();
    (el('[data-testid="add-home"]') as HTMLButtonElement).click();
    harness.detectChanges();
    type(homePrice(), '380000');
    expect(el('[data-testid="remove-home"]')!.textContent?.trim()).toBe('Remove Home C');

    (el('[data-testid="remove-home"]') as HTMLButtonElement).click();
    harness.detectChanges();
    jest.advanceTimersByTime(RECALCULATE_DELAY_MS);
    harness.detectChanges();

    expect(TestBed.inject(ComparisonStore).request()!.homes.map((h) => h.homePrice)).toEqual([415_000, 415_000]);
    expect(el('[data-testid="loan-heading"]')!.textContent).toBe('Home B');
    expect(el('[data-testid="remove-home"]')).toBeNull();
    switchTo('a');
    expect(el('[data-testid="remove-home"]')).toBeNull();
  });

  it('saves the comparison, and shows it side by side', async () => {
    await open('/compare');
    expect(TestBed.inject(ComparisonStore).savePayload()).toEqual(expect.objectContaining({ otherHomes: [expect.anything()] }));
    expect(el('app-compare-results')).not.toBeNull();
  });
});
