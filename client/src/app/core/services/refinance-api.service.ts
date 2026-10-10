import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RefinanceRequest, RefinanceResponse } from '../models/refinance.models';

/** HTTP gateway for the refinance comparison. Errors arrive as ProblemDetails. */
@Injectable({ providedIn: 'root' })
export class RefinanceApiService {
  private readonly http = inject(HttpClient);

  /** Posts a request to `POST /api/v1/refinance/analyze`. */
  analyze(request: RefinanceRequest): Observable<RefinanceResponse> {
    return this.http.post<RefinanceResponse>('/api/v1/refinance/analyze', request);
  }
}
