import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StrategyComparison, StrategyRequest } from '../models/strategy.models';

/** HTTP gateway for the pay-off-or-invest comparison. Errors arrive as ProblemDetails. */
@Injectable({ providedIn: 'root' })
export class StrategyApiService {
  private readonly http = inject(HttpClient);

  /** Posts a request to `POST /api/v1/strategies/compare`. */
  compare(request: StrategyRequest): Observable<StrategyComparison> {
    return this.http.post<StrategyComparison>('/api/v1/strategies/compare', request);
  }
}
