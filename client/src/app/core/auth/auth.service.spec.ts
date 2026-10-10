import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const answerWhoAmI = (email: string | null) => {
    const call = http.expectOne('/api/v1/account/manage/info');
    if (email) call.flush({ email, isEmailConfirmed: false });
    else call.flush(null, { status: 401, statusText: 'Unauthorized' });
  };

  it('finds out who is signed in from the session', () => {
    auth.load().subscribe();
    answerWhoAmI('alice@example.com');

    expect(auth.user()).toEqual({ email: 'alice@example.com' });
  });

  it('treats a 401 as signed out, not as an error', () => {
    let failed = false;
    auth.load().subscribe({ error: () => (failed = true) });
    answerWhoAmI(null);

    expect(auth.user()).toBeNull();
    expect(failed).toBe(false);
  });

  it('signs in with a session cookie, then knows who it is', () => {
    auth.signIn('alice@example.com', 'correct-horse-1').subscribe();

    const login = http.expectOne('/api/v1/account/login?useCookies=true');
    expect(login.request.body).toEqual({ email: 'alice@example.com', password: 'correct-horse-1' });
    login.flush(null);
    answerWhoAmI('alice@example.com');

    expect(auth.user()).toEqual({ email: 'alice@example.com' });
  });

  it('creates an account, then signs in to it', () => {
    auth.register('bob@example.com', 'correct-horse-1').subscribe();

    const register = http.expectOne('/api/v1/account/register');
    expect(register.request.body).toEqual({ email: 'bob@example.com', password: 'correct-horse-1' });
    register.flush(null);
    http.expectOne('/api/v1/account/login?useCookies=true').flush(null);
    answerWhoAmI('bob@example.com');

    expect(auth.user()).toEqual({ email: 'bob@example.com' });
  });

  it('signs out', () => {
    auth.load().subscribe();
    answerWhoAmI('alice@example.com');

    auth.signOut().subscribe();
    http.expectOne((r) => r.url === '/api/v1/account/logout' && r.method === 'POST').flush(null, { status: 204, statusText: 'No Content' });

    expect(auth.user()).toBeNull();
  });
});
