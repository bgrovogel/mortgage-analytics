import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AverageRates, AverageRatesService } from './average-rates.service';

describe('AverageRatesService', () => {
  let service: AverageRatesService;
  let http: HttpTestingController;
  const rates: AverageRates = { asOf: '2026-10-15', thirtyYearFixed: 7.41, fifteenYearFixed: 6.71, source: 'Freddie Mac Primary Mortgage Market Survey' };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AverageRatesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('has no rates until they arrive, then has them', () => {
    expect(service.rates()).toBeNull();

    service.load();
    http.expectOne('/api/v1/rates/average').flush(rates);

    expect(service.rates()).toEqual(rates);
  });

  it('asks once, however many forms ask', () => {
    service.load();
    service.load();
    service.load();

    http.expectOne('/api/v1/rates/average').flush(rates);
  });

  it('has none when the API has none to give', () => {
    service.load();
    http.expectOne('/api/v1/rates/average').flush(null, { status: 204, statusText: 'No Content' });

    expect(service.rates()).toBeNull();
  });

  it('has none when the request fails, and says nothing about it', () => {
    service.load();
    http.expectOne('/api/v1/rates/average').flush('down', { status: 500, statusText: 'Server Error' });

    expect(service.rates()).toBeNull();
  });
});
