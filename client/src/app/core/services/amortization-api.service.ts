import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AmortizationRequest, AmortizationResponse } from '../models/amortization.models';

/** Thin HTTP gateway. Components depend on this, never on HttpClient directly. */
@Injectable({ providedIn: 'root' })
export class AmortizationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/amortization';

  /**
   * Posts a request to `POST /api/v1/amortization/calculate`.
   * Errors are returned as `HttpErrorResponse` carrying RFC 9457 problem details; see `toErrorMessages`.
   */
  calculate(request: AmortizationRequest): Observable<AmortizationResponse> {
    return this.http.post<AmortizationResponse>(`${this.baseUrl}/calculate`, request);
  }
}
