import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FhaLimitsService } from './fha-limits.service';

describe('FhaLimitsService', () => {
  it("fetches HUD's county limits once, however often they are asked for", () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(FhaLimitsService);
    const http = TestBed.inject(HttpTestingController);
    const seen: number[] = [];

    service.limits().subscribe((l) => seen.push(l.year));
    service.limits().subscribe((l) => seen.push(l.year));
    http.expectOne('/api/v1/fha/loan-limits').flush({ year: 2026, source: '', floor: 541_287, ceiling: 1_249_125, states: {}, counties: [] });
    http.verify();

    expect(seen).toEqual([2026, 2026]);
  });
});
