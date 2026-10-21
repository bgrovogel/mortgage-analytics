import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

/** This week's average mortgage rates (mirrors AverageRatesResponse in the API). */
export interface AverageRates {
  /** The week they are for, a date (yyyy-MM-dd). */
  asOf: string;
  /** The 30-year fixed-rate average, as a percentage. */
  thirtyYearFixed: number;
  /** The 15-year fixed-rate average, as a percentage. */
  fifteenYearFixed: number;
  /** Who publishes them. */
  source: string;
}

/**
 * This week's average rates, asked for once and kept for the visit. The API answers with nothing when it cannot say (the
 * survey is unreachable or switched off), and so does a failed request: a rate is a convenience, and a form that has none
 * carries on as it was.
 */
@Injectable({ providedIn: 'root' })
export class AverageRatesService {
  private readonly http = inject(HttpClient);
  private readonly _rates = signal<AverageRates | null>(null);
  private asked = false;

  /** The average rates, or null until they arrive, or when there are none. */
  readonly rates = this._rates.asReadonly();

  /** Asks for the rates, the first time only. */
  load(): void {
    if (this.asked) return;
    this.asked = true;
    this.http
      .get<AverageRates | null>('/api/v1/rates/average')
      .pipe(catchError(() => of(null)))
      .subscribe((rates) => this._rates.set(rates));
  }
}
