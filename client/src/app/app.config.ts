import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { catchError, of } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    // Ask who is signed in before the first navigation, so guards and the header know at once.
    // If the API is down the app still starts, signed out; the calculators work without an account.
    provideAppInitializer(() => inject(AuthService).load().pipe(catchError(() => of(undefined)))),
  ],
};
