import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';

/** The signed-in user, as far as the app needs to know. */
export interface User {
  email: string;
}

/**
 * Who is signed in. The API keeps the session in an HttpOnly cookie that scripts cannot read, so the
 * app asks the API ("manage/info") instead of looking for a token. Uses ASP.NET Core Identity's
 * built-in endpoints under /api/v1/account.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/account';

  private readonly current = signal<User | null>(null);

  /** The signed-in user, or null when signed out. */
  readonly user = this.current.asReadonly();

  /** Asks the API who the session belongs to. A 401 simply means nobody is signed in. */
  load(): Observable<void> {
    return this.http.get<User>(`${this.baseUrl}/manage/info`).pipe(
      map(({ email }) => this.current.set({ email })),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.current.set(null);
          return of(undefined);
        }
        return throwError(() => error);
      }),
    );
  }

  /** Signs in; the API answers with the session cookie. */
  signIn(email: string, password: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/login?useCookies=true`, { email, password }).pipe(switchMap(() => this.load()));
  }

  /** Creates an account and signs in to it. */
  register(email: string, password: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/register`, { email, password }).pipe(switchMap(() => this.signIn(email, password)));
  }

  /** Signs out, ending the session. */
  signOut(): Observable<void> {
    return this.http.post(`${this.baseUrl}/logout`, null).pipe(
      tap(() => this.current.set(null)),
      map(() => undefined),
    );
  }
}
