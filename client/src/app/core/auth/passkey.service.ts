import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** A passkey, as its owner sees it. */
export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** What the API sends to start a ceremony: the WebAuthn options in their JSON form, and the sealed state to send back. */
interface Ceremony<Options> {
  state: string;
  options: Options;
}

/** How a sign-in with a passkey ended, when it did not fail: the person signed in, or closed the device's prompt. */
export type PasskeySignIn = 'signed-in' | 'cancelled';

/** True when the person closed the prompt (or ran out of time): not a failure to report. */
const isCancelled = (error: unknown): boolean =>
  error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');

/**
 * Passkeys: signing in with a key pair kept on the device, unlocked by its fingerprint, face or PIN. The browser does
 * the cryptography (`navigator.credentials`); this carries its options and answers to and from the API, which checks
 * them. The options and answers travel as WebAuthn's own JSON form, which current browsers read and write directly, so
 * nothing here touches a byte.
 */
@Injectable({ providedIn: 'root' })
export class PasskeyService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = '/api/v1/account/passkeys';

  /** True when this browser can make and use passkeys. */
  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'PublicKeyCredential' in window &&
      typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function' &&
      typeof navigator !== 'undefined' &&
      !!navigator.credentials
    );
  }

  /** The signed-in user's passkeys. */
  list(): Observable<Passkey[]> {
    return this.http.get<Passkey[]>(this.baseUrl);
  }

  /** Removes one of the signed-in user's passkeys. */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Has this device make a passkey for the signed-in user, under a name; null when the person closed the prompt. */
  register(name: string): Observable<Passkey | null> {
    return this.http.post<Ceremony<PublicKeyCredentialCreationOptionsJSON>>(`${this.baseUrl}/registration-options`, null).pipe(
      switchMap(({ state, options }) =>
        from(navigator.credentials.create({ publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options) })).pipe(
          switchMap((credential) => this.http.post<Passkey>(this.baseUrl, { name, state, credential: (credential as PublicKeyCredential).toJSON() })),
          catchError((error: unknown) => (isCancelled(error) ? of(null) : throwError(() => error))),
        ),
      ),
    );
  }

  /** Signs in with a passkey the device holds for this site, then learns who is signed in. */
  signIn(): Observable<PasskeySignIn> {
    return this.http.post<Ceremony<PublicKeyCredentialRequestOptionsJSON>>(`${this.baseUrl}/sign-in-options`, null).pipe(
      switchMap(({ state, options }) =>
        from(navigator.credentials.get({ publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options) })).pipe(
          switchMap((credential) => this.http.post(`${this.baseUrl}/sign-in`, { state, credential: (credential as PublicKeyCredential).toJSON() })),
          switchMap(() => this.auth.load()),
          map((): PasskeySignIn => 'signed-in'),
          catchError((error: unknown) => (isCancelled(error) ? of<PasskeySignIn>('cancelled') : throwError(() => error))),
        ),
      ),
    );
  }
}
