import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import * as files from '../files/save-file';
import { AccountExportService } from './account-export.service';

describe('AccountExportService', () => {
  let http: HttpTestingController;
  let service: AccountExportService;
  let saved: jest.SpyInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AccountExportService);
    saved = jest.spyOn(files, 'saveFile').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });

  it('asks for the data, and saves what comes back under the name the API gave it', async () => {
    const done = new Promise<void>((resolve) => service.download().subscribe(resolve));

    http.expectOne({ method: 'GET', url: '/api/v1/account/export' }).flush(new Blob(['{"email":"a@b.c"}']), {
      headers: { 'Content-Disposition': 'attachment; filename=mortgage-analytics-data-2026-10-21.json' },
    });
    await done;

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0][0]).toBe('mortgage-analytics-data-2026-10-21.json');
    expect(saved.mock.calls[0][2]).toBe('application/json');
  });

  it('names the file itself when the API did not', async () => {
    const done = new Promise<void>((resolve) => service.download().subscribe(resolve));

    http.expectOne('/api/v1/account/export').flush(new Blob(['{}']));
    await done;

    expect(saved.mock.calls[0][0]).toBe('mortgage-analytics-data.json');
  });

  it('saves nothing when the API refuses', () => {
    let failed: unknown;
    service.download().subscribe({ error: (e) => (failed = e) });

    http.expectOne('/api/v1/account/export').flush(new Blob(['no']), { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBeDefined();
    expect(saved).not.toHaveBeenCalled();
  });
});
