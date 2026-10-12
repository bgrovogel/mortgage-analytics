import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { FhaLoanLimits } from '../models/amortization.models';

/** HUD's FHA county loan limits, fetched once when first asked for: they change once a year. */
@Injectable({ providedIn: 'root' })
export class FhaLimitsService {
  private readonly http = inject(HttpClient);
  private cached?: Observable<FhaLoanLimits>;

  /** The limits, from `GET /api/v1/fha/loan-limits`, shared by every caller. */
  limits(): Observable<FhaLoanLimits> {
    this.cached ??= this.http.get<FhaLoanLimits>('/api/v1/fha/loan-limits').pipe(shareReplay(1));
    return this.cached;
  }
}
