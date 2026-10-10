import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SavedCalculation, SavedInputs } from '../models/saved-calculation.models';

/** HTTP gateway for saved calculations (`/api/v1/calculations`). Errors arrive as ProblemDetails. */
@Injectable({ providedIn: 'root' })
export class SavedCalculationsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/calculations';

  /** Saved calculations, most recently changed first; a search keeps only names containing it. */
  list(search = ''): Observable<SavedCalculation[]> {
    const term = search.trim();
    const params = term ? new HttpParams().set('search', term) : undefined;
    return this.http.get<SavedCalculation[]>(this.baseUrl, { params });
  }

  /** Saves calculator inputs or a refinance comparison under a name. */
  save(name: string, saved: SavedInputs): Observable<SavedCalculation> {
    return this.http.post<SavedCalculation>(this.baseUrl, { name, ...saved });
  }

  /** Renames a saved calculation, or replaces its inputs. */
  update(id: string, name: string, saved: SavedInputs): Observable<SavedCalculation> {
    return this.http.put<SavedCalculation>(`${this.baseUrl}/${id}`, { name, ...saved });
  }

  /** Deletes a saved calculation. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
