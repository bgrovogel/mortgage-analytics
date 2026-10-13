import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of } from 'rxjs';
import { fakeCharts } from '../testing/fake-charts';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { AuthService, User } from './core/auth/auth.service';
import { DevMailboxService } from './core/dev/dev-mailbox.service';
import { AmortizationApiService } from './core/services/amortization-api.service';
import { RefinanceApiService } from './core/services/refinance-api.service';
import { SavedCalculationsApiService } from './core/services/saved-calculations-api.service';
import { CalculatorStore } from './features/calculator/calculator.store';
import { RefinanceStore } from './features/refinance/refinance.store';
import { StrategyApiService } from './core/services/strategy-api.service';
import { StrategyStore } from './features/strategy/strategy.store';

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
        { provide: StrategyApiService, useValue: { compare: () => NEVER } },
        { provide: AuthService, useValue: { user, signOut, confirmEmail: () => NEVER } },
        { provide: DevMailboxService, useValue: { list: () => NEVER, available: () => of(false) } },
      ],
    });
  });

  const render = () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('renders the title and the page navigation, and the API docs in the footer, apart from the pages', () => {
    const { root } = render();

    expect(root.querySelector('h1')?.textContent).toBe('Mortgage Analytics');
    expect([...root.querySelectorAll('nav[aria-label="Pages"] a')].map((a) => a.textContent!.trim()))
      .toEqual(['Calculator', 'Refinance', 'Pay off or invest', 'History']);
    expect(root.querySelector('footer a[href="/swagger"]')?.textContent?.trim()).toBe('API docs ↗');
  });

  it('leaves what each page answers to the page, rather than one line repeated on every page', () => {
    expect(render().root.querySelector('.tagline')).toBeNull();
  });

  it('links the brand home, named by the title alone: the mark beside it is decorative', () => {
    const { root } = render();
    const brand = root.querySelector('a.brand')!;

    expect(brand.getAttribute('href')).toBe('/calculator');
    expect(brand.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(brand.textContent?.trim()).toBe('Mortgage Analytics');
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
    TestBed.inject(StrategyStore).linkTo({ id: 's1', name: 'Pay off?' });
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { fixture, root } = render();
    expect(root.querySelector('[data-testid="signed-in-as"]')?.textContent).toContain('alice@example.com');

    (root.querySelector('[data-testid="sign-out"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(signOut).toHaveBeenCalled();
    expect(TestBed.inject(CalculatorStore).saved()).toBeNull();
    expect(TestBed.inject(RefinanceStore).saved()).toBeNull();
    expect(TestBed.inject(StrategyStore).saved()).toBeNull();
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

  it('links the signed-in email to the account page', () => {
    user.set({ email: 'alice@example.com' });
    const { root } = render();

    expect(root.querySelector('[data-testid="account-link"]')?.getAttribute('href')).toBe('/account');
  });

  it('asks for an account before showing the account page', async () => {
    await RouterTestingHarness.create('/account');

    expect(TestBed.inject(Router).url).toBe('/sign-in?returnUrl=%2Faccount');
  });

  it('shows the account page to a signed-in user', async () => {
    user.set({ email: 'alice@example.com' });

    const harness = await RouterTestingHarness.create('/account');

    expect(harness.routeNativeElement?.querySelector('[data-testid="delete-start"]')).not.toBeNull();
  });

  it.each([
    ['/confirm-email', 'confirm-email'],
    ['/forgot-password', 'forgot-form'],
    ['/reset-password?email=a%40example.com&code=c', 'reset-form'],
    ['/dev/mailbox', 'mailbox-refresh'],
  ])('has a page at %s for the account emails', async (url, testId) => {
    const harness = await RouterTestingHarness.create(url);

    expect(harness.routeNativeElement?.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
  });

  /** Renders the real app shell at `url`. */
  const shellAt = async (url: string) => {
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it.each(['/sign-in', '/account', '/forgot-password', '/reset-password?email=a%40example.com&code=c', '/confirm-email', '/dev/mailbox'])(
    'keeps %s focused: no page tabs or account controls, just a way back', async (url) => {
      const shell = await shellAt(url);

      expect(shell.querySelector('nav[aria-label="Pages"]')).toBeNull();
      expect(shell.querySelector('[data-testid="sign-in-link"]')).toBeNull();
      expect(shell.querySelector('[data-testid="back-to-app"]')!.getAttribute('href')).toBe('/calculator');
    });

  it('shows the page tabs everywhere else', async () => {
    const shell = await shellAt('/refinance');

    expect(shell.querySelector('nav[aria-label="Pages"]')).not.toBeNull();
    expect(shell.querySelector('[data-testid="back-to-app"]')).toBeNull();
  });
});
