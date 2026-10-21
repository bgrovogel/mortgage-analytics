import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** One place the account is signed in (mirrors UserSessionResponse in the API). */
export interface UserSession {
  id: string;
  /** The browser and system, e.g. "Chrome on Windows". */
  device: string;
  createdAt: string; // ISO date-time
  /** When it was last used, to within a few minutes. */
  lastSeenAt: string; // ISO date-time
  /** True for the session making the request. */
  current: boolean;
}

/** Where the account is signed in, and ending those places from another. */
@Injectable({ providedIn: 'root' })
export class SessionsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/account/sessions';

  /** The account's sessions, most recently used first. */
  list(): Observable<UserSession[]> {
    return this.http.get<UserSession[]>(this.baseUrl);
  }

  /** Ends one of the other sessions: that device is signed out at its next request. */
  end(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Ends every session but this one, and says how many. */
  endOthers(): Observable<{ ended: number }> {
    return this.http.post<{ ended: number }>(`${this.baseUrl}/end-others`, null);
  }
}
