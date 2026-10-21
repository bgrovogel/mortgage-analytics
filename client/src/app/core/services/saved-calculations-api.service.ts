import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SavedCalculation, SavedInputs } from '../models/saved-calculation.models';
import { parseTags } from '../state/tags';

/** HTTP gateway for saved calculations (`/api/v1/calculations`). Errors arrive as ProblemDetails. */
/** The note as the API takes it: left out when there is none (an update without one clears it). */
const noteOf = (note: string | null) => (note?.trim() ? { note: note.trim() } : {});

/** The tags as the API takes them: trimmed, without blanks or repeats, and left out when there are none. */
const tagsOf = (tags: readonly string[]) => {
  const kept = parseTags(tags.join(','));
  return kept.length > 0 ? { tags: kept } : {};
};

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
  save(name: string, saved: SavedInputs, note: string | null = null, tags: readonly string[] = []): Observable<SavedCalculation> {
    return this.http.post<SavedCalculation>(this.baseUrl, { name, ...noteOf(note), ...tagsOf(tags), ...saved });
  }

  /** Renames a saved calculation, or replaces its inputs. */
  update(id: string, name: string, saved: SavedInputs, note: string | null = null, tags: readonly string[] = []): Observable<SavedCalculation> {
    return this.http.put<SavedCalculation>(`${this.baseUrl}/${id}`, { name, ...noteOf(note), ...tagsOf(tags), ...saved });
  }

  /** Deletes a saved calculation. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
