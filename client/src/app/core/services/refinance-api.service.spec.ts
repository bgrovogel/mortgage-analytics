import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RefinanceRequest } from '../models/refinance.models';
import { RefinanceApiService } from './refinance-api.service';

describe('RefinanceApiService', () => {
  it('posts the request to the versioned refinance endpoint', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const request = { currentBalance: 300_000 } as RefinanceRequest;

    TestBed.inject(RefinanceApiService).analyze(request).subscribe();

    const call = http.expectOne('/api/v1/refinance/analyze');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toBe(request);
    call.flush({});
    http.verify();
  });
});
