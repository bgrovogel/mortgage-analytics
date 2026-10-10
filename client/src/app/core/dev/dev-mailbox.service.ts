import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

/** An email the app sent, as the development mailbox shows it. */
export interface OutboxEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  actionUrl: string;
  sentAt: string;
}

/**
 * The development mailbox: with no mail server, the API keeps sent emails in a local outbox and, when it
 * runs in Development, lists them. This is what lets a local demo confirm emails and reset passwords.
 * In Production the endpoint does not exist (it would show every user's links), so `list` returns null.
 */
@Injectable({ providedIn: 'root' })
export class DevMailboxService {
  private readonly http = inject(HttpClient);

  /** Every email in the outbox, newest first; null when there is no development mailbox. */
  list(): Observable<OutboxEmail[] | null> {
    return this.http.get<OutboxEmail[]>('/api/v1/dev/outbox').pipe(catchError(() => of(null)));
  }

  /** Empties the outbox, e.g. before a demo. */
  clear(): Observable<void> {
    return this.http.delete<void>('/api/v1/dev/outbox');
  }

  /** Whether a development mailbox exists, so pages can point to it ("Running locally? Open the dev mailbox"). */
  available(): Observable<boolean> {
    return this.list().pipe(map((emails) => emails !== null));
  }
}
