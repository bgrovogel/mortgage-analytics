import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { PasskeyService } from './passkey.service';

describe('PasskeyService', () => {
  const URL = '/api/v1/account/passkeys';
  let http: HttpTestingController;
  let service: PasskeyService;
  let auth: { load: jest.Mock };
  let credentials: { create: jest.Mock; get: jest.Mock };

  /** A browser that can do passkeys: it turns the API's JSON into what the credentials calls take, and back. */
  const installBrowser = () => {
    (window as unknown as Record<string, unknown>)['PublicKeyCredential'] = {
      parseCreationOptionsFromJSON: (options: unknown) => ({ parsedCreation: options }),
      parseRequestOptionsFromJSON: (options: unknown) => ({ parsedRequest: options }),
    };
    credentials = { create: jest.fn(), get: jest.fn() };
    Object.defineProperty(navigator, 'credentials', { value: credentials, configurable: true });
  };
  const removeBrowser = () => {
    delete (window as unknown as Record<string, unknown>)['PublicKeyCredential'];
    Object.defineProperty(navigator, 'credentials', { value: undefined, configurable: true });
  };

  beforeEach(() => {
    installBrowser();
    auth = { load: jest.fn().mockReturnValue(of(undefined)) };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: auth }] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PasskeyService);
  });

  afterEach(() => {
    http.verify();
    removeBrowser();
  });

  const signedCredential = { id: 'abc', toJSON: () => ({ id: 'abc', response: { signature: 'sig' } }) };
  const madeCredential = { id: 'abc', toJSON: () => ({ id: 'abc', response: { attestationObject: 'att' } }) };

  it('knows whether this browser can do passkeys', () => {
    expect(service.supported()).toBe(true);

    removeBrowser();

    expect(service.supported()).toBe(false);
  });

  describe('signing in', () => {
    it('asks the device to sign the challenge, sends its answer back with the state, and then asks who is signed in', async () => {
      credentials.get.mockResolvedValue(signedCredential);
      const result = new Promise((resolve) => service.signIn().subscribe(resolve));

      http.expectOne({ method: 'POST', url: `${URL}/sign-in-options` }).flush({ state: 'sealed', options: { challenge: 'c' } });
      await Promise.resolve();
      await Promise.resolve();
      const send = http.expectOne({ method: 'POST', url: `${URL}/sign-in` });
      send.flush(null, { status: 204, statusText: 'No Content' });
      await result;

      expect(credentials.get).toHaveBeenCalledWith({ publicKey: { parsedRequest: { challenge: 'c' } } });
      expect(send.request.body).toEqual({ state: 'sealed', credential: { id: 'abc', response: { signature: 'sig' } } });
      expect(auth.load).toHaveBeenCalledTimes(1);
      await expect(result).resolves.toBe('signed-in');
    });

    it('says it was cancelled when the person closes the device prompt, and sends nothing', async () => {
      credentials.get.mockRejectedValue(new DOMException('closed', 'NotAllowedError'));
      const result = new Promise((resolve) => service.signIn().subscribe(resolve));

      http.expectOne({ method: 'POST', url: `${URL}/sign-in-options` }).flush({ state: 's', options: {} });
      await Promise.resolve();
      await Promise.resolve();

      await expect(result).resolves.toBe('cancelled');
      http.expectNone(`${URL}/sign-in`);
      expect(auth.load).not.toHaveBeenCalled();
    });

    it('fails with the API\'s answer when the API refuses the passkey', async () => {
      credentials.get.mockResolvedValue(signedCredential);
      const failure = new Promise((resolve) => service.signIn().subscribe({ error: resolve }));

      http.expectOne({ method: 'POST', url: `${URL}/sign-in-options` }).flush({ state: 's', options: {} });
      await Promise.resolve();
      await Promise.resolve();
      http.expectOne({ method: 'POST', url: `${URL}/sign-in` }).flush({ title: 'no' }, { status: 401, statusText: 'Unauthorized' });

      await expect(failure).resolves.toEqual(expect.objectContaining({ status: 401 }));
      expect(auth.load).not.toHaveBeenCalled();
    });
  });

  describe('adding a passkey', () => {
    it('has the device make one for the API\'s options, and sends it with the name and the state', async () => {
      credentials.create.mockResolvedValue(madeCredential);
      const result = new Promise((resolve) => service.register('MacBook').subscribe(resolve));

      http.expectOne({ method: 'POST', url: `${URL}/registration-options` }).flush({ state: 'sealed', options: { challenge: 'c' } });
      await Promise.resolve();
      await Promise.resolve();
      const send = http.expectOne({ method: 'POST', url: URL });
      send.flush({ id: 'abc', name: 'MacBook', createdAt: '2026-10-16T00:00:00Z', lastUsedAt: null });

      expect(credentials.create).toHaveBeenCalledWith({ publicKey: { parsedCreation: { challenge: 'c' } } });
      expect(send.request.body).toEqual({ name: 'MacBook', state: 'sealed', credential: { id: 'abc', response: { attestationObject: 'att' } } });
      await expect(result).resolves.toEqual({ id: 'abc', name: 'MacBook', createdAt: '2026-10-16T00:00:00Z', lastUsedAt: null });
    });

    it('is cancelled quietly when the person closes the device prompt', async () => {
      credentials.create.mockRejectedValue(new DOMException('closed', 'NotAllowedError'));
      const result = new Promise((resolve) => service.register('MacBook').subscribe(resolve));

      http.expectOne({ method: 'POST', url: `${URL}/registration-options` }).flush({ state: 's', options: {} });
      await Promise.resolve();
      await Promise.resolve();

      await expect(result).resolves.toBeNull();
      http.expectNone(URL);
    });
  });

  it('lists the passkeys, and removes one by its id', () => {
    let listed: unknown;
    service.list().subscribe((passkeys) => (listed = passkeys));
    http.expectOne({ method: 'GET', url: URL }).flush([{ id: 'abc', name: 'MacBook', createdAt: 'x', lastUsedAt: null }]);

    service.remove('abc').subscribe();
    http.expectOne({ method: 'DELETE', url: `${URL}/abc` }).flush(null, { status: 204, statusText: 'No Content' });

    expect(listed).toEqual([{ id: 'abc', name: 'MacBook', createdAt: 'x', lastUsedAt: null }]);
  });
});
