import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DevMailboxService } from './dev-mailbox.service';

describe('DevMailboxService', () => {
  let service: DevMailboxService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DevMailboxService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists the outbox when the API runs in Development', () => {
    let result: unknown;
    service.available().subscribe((a) => (result = a));

    http.expectOne('/api/v1/dev/outbox').flush([]);

    expect(result).toBe(true);
  });

  it('reports no mailbox when the endpoint does not exist (Production)', () => {
    let result: unknown = 'unset';
    service.list().subscribe((emails) => (result = emails));

    http.expectOne('/api/v1/dev/outbox').flush(null, { status: 404, statusText: 'Not Found' });

    expect(result).toBeNull();
  });

  it('clears the outbox', () => {
    service.clear().subscribe();

    const call = http.expectOne('/api/v1/dev/outbox');
    expect(call.request.method).toBe('DELETE');
    call.flush(null, { status: 204, statusText: 'No Content' });
  });
});
