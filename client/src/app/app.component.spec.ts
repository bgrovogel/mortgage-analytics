import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of } from 'rxjs';
import { fakeCharts } from '../testing/fake-charts';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { AuthService, User } from './core/auth/auth.service';
import { AmortizationApiService } from './core/services/amortization-api.service';
import { RefinanceApiService } from './core/services/refinance-api.service';
import { SavedCalculationsApiService } from './core/services/saved-calculations-api.service';
import { CalculatorStore } from './features/calculator/calculator.store';
import { RefinanceStore } from './features/refinance/refinance.store';

describe('AppComponent', () => {
  let user: ReturnType<typeof signal<User | null>>;
  let signOut: jest.Mock;

  beforeEach(() => {
    user = signal<User | null>(null);
    signOut = jest.fn(() => {
      user.set(null);
      return of(undefined);
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        fakeCharts().provider,
        { provide: AmortizationApiService, useValue: { calculate: () => NEVER } },
        { provide: SavedCalculationsApiService, useValue: { list: () => NEVER } },
        { provide: RefinanceApiService, useValue: { analyze: () => NEVER } },
        { provide: AuthService, useValue: { user, signOut } },
      ],
    });
  });

  const render = () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('renders the title, the page navigation and a link to the API docs', () => {
    const { root } = render();

    expect(root.querySelector('h1')?.textContent).toBe('Mortgage Analytics');
    expect([...root.querySelectorAll('nav[aria-label="Pages"] a')].map((a) => a.textContent!.trim()))
      .toEqual(['Calculator', 'Refinance', 'History', 'API docs ↗']);
    expect(root.querySelector('a[href="/swagger"]')).not.toBeNull();
  });

  it('offers to sign in when nobody is signed in', () => {
    const { root } = render();

    expect(root.querySelector('[data-testid="sign-in-link"]')?.getAttribute('href')).toBe('/sign-in');
    expect(root.querySelector('[data-testid="signed-in-as"]')).toBeNull();
  });

  it('shows who is signed in, and signs out, forgetting which saved items the pages came from', async () => {
    user.set({ email: 'alice@example.com' });
    TestBed.inject(CalculatorStore).linkTo({ id: 'c1', name: 'Oak St' });
    TestBed.inject(RefinanceStore).linkTo({ id: 'r1', name: 'Refi' });
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { fixture, root } = render();
    expect(root.querySelector('[data-testid="signed-in-as"]')?.textContent).toContain('alice@example.com');

    (root.querySelector('[data-testid="sign-out"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(signOut).toHaveBeenCalled();
    expect(TestBed.inject(CalculatorStore).saved()).toBeNull();
    expect(TestBed.inject(RefinanceStore).saved()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/calculator');
    expect(root.querySelector('[data-testid="sign-in-link"]')).not.toBeNull();
  });

  it.each(['/', '/no-such-page', '/calculator'])('sends %s to the calculator overview', async (url) => {
    await RouterTestingHarness.create(url);

    expect(TestBed.inject(Router).url).toBe('/calculator/overview');
  });

  it('has a Refinance page', async () => {
    const harness = await RouterTestingHarness.create('/refinance');

    expect(harness.routeNativeElement?.querySelector('[data-testid="refinance-form"]')).not.toBeNull();
  });

  it('asks for an account before showing History', async () => {
    await RouterTestingHarness.create('/history');

    expect(TestBed.inject(Router).url).toBe('/sign-in?returnUrl=%2Fhistory');
  });

  it('shows History to a signed-in user', async () => {
    user.set({ email: 'alice@example.com' });

    const harness = await RouterTestingHarness.create('/history');

    expect(harness.routeNativeElement?.querySelector('[data-testid="history-search"]')).not.toBeNull();
  });
});
