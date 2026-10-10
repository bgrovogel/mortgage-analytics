import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService, User } from './auth.service';
import { safeReturnUrl, signedInGuard } from './signed-in.guard';

describe('signedInGuard', () => {
  const run = (user: User | null) => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { user: signal(user) } }] });
    return TestBed.runInInjectionContext(() =>
      signedInGuard({} as ActivatedRouteSnapshot, { url: '/history?x=1' } as RouterStateSnapshot));
  };

  it('lets a signed-in user through', () => {
    expect(run({ email: 'alice@example.com' })).toBe(true);
  });

  it('sends everyone else to sign in, and back here afterwards', () => {
    const result = run(null) as UrlTree;

    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/sign-in?returnUrl=%2Fhistory%3Fx%3D1');
  });
});

describe('safeReturnUrl', () => {
  it.each([
    ['/history', '/history'],
    ['/calculator/schedule?x=1', '/calculator/schedule?x=1'],
    [null, '/history'],
    ['https://evil.example', '/history'],
    ['//evil.example', '/history'],
    ['/\\evil.example', '/history'],
  ])('turns %p into %p, so sign-in never redirects off the site', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
