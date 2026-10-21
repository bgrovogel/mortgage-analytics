import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { PreloadAllModules, TitleStrategy, provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { catchError, of } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { KeyFigureSync } from './features/calculator/savings-summary/key-figure-sync';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Pages are separate chunks (app.routes.ts); preloading fetches them once the first page is up.
    // A link to a part of a page (the glossary's terms) scrolls to it.
    provideRouter(routes, withPreloading(PreloadAllModules), withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    // Every page title is its name in the page's language, then the app's name.
    { provide: TitleStrategy, useExisting: TranslatedTitleStrategy },
    provideHttpClient(withFetch()),
    // Ask who is signed in before the first navigation, so guards and the header know at once.
    // If the API is down the app still starts, signed out; the calculators work without an account.
    provideAppInitializer(() => inject(AuthService).load().pipe(catchError(() => of(undefined)))),
    // Keep the key figures' arrangement with the account of whoever is signed in.
    provideAppInitializer(() => {
      inject(KeyFigureSync);
    }),
  ],
};
