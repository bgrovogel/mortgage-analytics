import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AmortizationRequest } from '../models/amortization.models';
import { RefinanceRequest } from '../models/refinance.models';
import { SavedCalculationsApiService } from './saved-calculations-api.service';

describe('SavedCalculationsApiService', () => {
  let service: SavedCalculationsApiService;
  let http: HttpTestingController;
  const inputs = { homePrice: 250_000 } as AmortizationRequest;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SavedCalculationsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists every saved calculation when there is no search', () => {
    service.list('  ').subscribe();

    const call = http.expectOne((r) => r.url === '/api/v1/calculations');
    expect(call.request.method).toBe('GET');
    expect(call.request.params.has('search')).toBe(false);
    call.flush([]);
  });

  it('passes a search to the server, trimmed', () => {
    service.list(' oak ').subscribe();

    const call = http.expectOne((r) => r.url === '/api/v1/calculations');
    expect(call.request.params.get('search')).toBe('oak');
    call.flush([]);
  });

  it('saves a name and calculator inputs', () => {
    service.save('Oak St', { inputs }).subscribe();

    const call = http.expectOne('/api/v1/calculations');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({ name: 'Oak St', inputs });
    call.flush({});
  });

  it('sends a note with a save or an update, trimmed, and leaves it out when blank', () => {
    service.save('Oak St', { inputs }, '  Ask about the roof  ').subscribe();
    const withNote = http.expectOne('/api/v1/calculations');
    expect(withNote.request.body).toEqual({ name: 'Oak St', note: 'Ask about the roof', inputs });
    withNote.flush({});

    service.update('abc', 'Oak St', { inputs }, 'Roof checked').subscribe();
    const updated = http.expectOne('/api/v1/calculations/abc');
    expect(updated.request.body).toEqual({ name: 'Oak St', note: 'Roof checked', inputs });
    updated.flush({});

    service.save('Oak St', { inputs }, '   ').subscribe();
    const blank = http.expectOne('/api/v1/calculations');
    expect(blank.request.body).toEqual({ name: 'Oak St', inputs });
    blank.flush({});
  });

  it('saves a refinance comparison the same way', () => {
    const refinance = { currentBalance: 300_000 } as RefinanceRequest;
    service.save('Refi', { refinance }).subscribe();

    const call = http.expectOne('/api/v1/calculations');
    expect(call.request.body).toEqual({ name: 'Refi', refinance });
    call.flush({});
  });

  it('replaces a saved calculation by id', () => {
    service.update('abc', 'New name', { inputs }).subscribe();

    const call = http.expectOne('/api/v1/calculations/abc');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual({ name: 'New name', inputs });
    call.flush({});
  });

  it('deletes a saved calculation by id', () => {
    service.delete('abc').subscribe();

    const call = http.expectOne('/api/v1/calculations/abc');
    expect(call.request.method).toBe('DELETE');
    call.flush(null, { status: 204, statusText: 'No Content' });
  });
});
