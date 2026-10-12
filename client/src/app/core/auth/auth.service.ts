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

  /** Creates an account. It can sign in once the email is confirmed with the link the API sends. */
  register(email: string, password: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/register`, { email, password }).pipe(map(() => undefined));
  }

  /** Sends the confirmation email again. The API answers the same whether or not the account exists. */
  resendConfirmation(email: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/resendConfirmationEmail`, { email }).pipe(map(() => undefined));
  }

  /** Confirms an email with the user id and code from the link in the confirmation email. */
  confirmEmail(userId: string, code: string, changedEmail: string | null = null): Observable<void> {
    const params: Record<string, string> = { userId, code };
    if (changedEmail) params['changedEmail'] = changedEmail;
    return this.http.get(`${this.baseUrl}/confirmEmail`, { params, responseType: 'text' }).pipe(map(() => undefined));
  }

  /** Asks for a password-reset email. The API answers the same whether or not the account exists. */
  forgotPassword(email: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/forgotPassword`, { email }).pipe(map(() => undefined));
  }

  /** Sets a new password with the code from the reset email. */
  resetPassword(email: string, resetCode: string, newPassword: string): Observable<void> {
    return this.http.post(`${this.baseUrl}/resetPassword`, { email, resetCode, newPassword }).pipe(map(() => undefined));
  }

  /**
   * Deletes the account and everything saved in it, once the API has checked the password; the API also ends the
   * session. A refused password leaves the user signed in.
   */
  deleteAccount(password: string): Observable<void> {
    return this.http.delete(this.baseUrl, { body: { password } }).pipe(
      tap(() => this.current.set(null)),
      map(() => undefined),
    );
  }

  /** Signs out, ending the session. */
  signOut(): Observable<void> {
    return this.http.post(`${this.baseUrl}/logout`, null).pipe(
      tap(() => this.current.set(null)),
      map(() => undefined),
    );
  }
}
