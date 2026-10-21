import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionsApiService } from './sessions-api.service';

describe('SessionsApiService', () => {
  let service: SessionsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SessionsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists the sessions', () => {
    service.list().subscribe();

    const call = http.expectOne('/api/v1/account/sessions');
    expect(call.request.method).toBe('GET');
    call.flush([]);
  });

  it('ends one session by id', () => {
    service.end('abc').subscribe();

    const call = http.expectOne('/api/v1/account/sessions/abc');
    expect(call.request.method).toBe('DELETE');
    call.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('ends every other session', () => {
    let ended = 0;
    service.endOthers().subscribe((r) => (ended = r.ended));

    const call = http.expectOne('/api/v1/account/sessions/end-others');
    expect(call.request.method).toBe('POST');
    call.flush({ ended: 2 });
    expect(ended).toBe(2);
  });
});
