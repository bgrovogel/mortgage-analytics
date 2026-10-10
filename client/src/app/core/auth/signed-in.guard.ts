import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Where signing in leads when there is no (safe) place to return to. */
const DEFAULT_RETURN_URL = '/history';

/**
 * Lets signed-in users through; sends anyone else to the sign-in page, remembering where they were
 * going. The session is checked at startup (see app.config), so the answer is already known here.
 */
export const signedInGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).user() ? true : inject(Router).createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });

/**
 * A return URL that stays on this site: a path starting with one "/". Anything else ("https://…",
 * "//host", "/\host") could send a freshly signed-in user to another site, so it falls back to History.
 */
export function safeReturnUrl(url: string | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : DEFAULT_RETURN_URL;
}
