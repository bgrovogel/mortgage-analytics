import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aResponse } from '../../../testing/builders';
import { AmortizationRequest } from '../models/amortization.models';
import { AmortizationApiService } from './amortization-api.service';

describe('AmortizationApiService', () => {
  let service: AmortizationApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AmortizationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the request to the versioned calculate endpoint and returns the response', () => {
    const request = { homePrice: 250_000 } as AmortizationRequest;
    const response = aResponse();
    let received: unknown;

    service.calculate(request).subscribe((r) => (received = r));

    const call = http.expectOne('/api/v1/amortization/calculate');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toBe(request);
    call.flush(response);
    expect(received).toEqual(response);
  });
});
