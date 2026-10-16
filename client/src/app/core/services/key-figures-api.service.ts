import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** The key figures under the Cost headline, as the account keeps them: by name, in the user's order. */
export interface KeyFigurePreferences {
  /** Every figure in order, shown or not; empty when the user has not arranged them. */
  order: string[];
  /** The figures put away. */
  hidden: string[];
}

/** HTTP gateway for a signed-in user's key-figure arrangement (`/api/v1/account/key-figures`). */
@Injectable({ providedIn: 'root' })
export class KeyFiguresApiService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/v1/account/key-figures';

  /** The user's arrangement; empty lists when they have none. */
  get(): Observable<KeyFigurePreferences> {
    return this.http.get<KeyFigurePreferences>(this.url);
  }

  /** Replaces the user's arrangement. */
  save(preferences: KeyFigurePreferences): Observable<void> {
    return this.http.put<void>(this.url, preferences);
  }
}
