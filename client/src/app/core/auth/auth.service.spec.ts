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

  it('creates an account without signing in: the email has to be confirmed first', () => {
    auth.register('bob@example.com', 'correct-horse-1').subscribe();

    const register = http.expectOne('/api/v1/account/register');
    expect(register.request.body).toEqual({ email: 'bob@example.com', password: 'correct-horse-1' });
    register.flush(null);

    expect(auth.user()).toBeNull();
  });

  it('confirms an email with the user id and code from the link', () => {
    auth.confirmEmail('u1', 'c1').subscribe();

    const call = http.expectOne((r) => r.url === '/api/v1/account/confirmEmail');
    expect(call.request.params.get('userId')).toBe('u1');
    expect(call.request.params.get('code')).toBe('c1');
    expect(call.request.params.has('changedEmail')).toBe(false);
    call.flush('Thank you for confirming your email.');
  });

  it('passes a changed email along when the link has one', () => {
    auth.confirmEmail('u1', 'c1', 'new@example.com').subscribe();

    const call = http.expectOne((r) => r.url === '/api/v1/account/confirmEmail');
    expect(call.request.params.get('changedEmail')).toBe('new@example.com');
    call.flush('ok');
  });

  it.each([
    ['resendConfirmation', '/api/v1/account/resendConfirmationEmail', { email: 'a@example.com' }],
    ['forgotPassword', '/api/v1/account/forgotPassword', { email: 'a@example.com' }],
  ] as const)('%s posts the email to %s', (method, url, body) => {
    auth[method]('a@example.com').subscribe();

    const call = http.expectOne(url);
    expect(call.request.body).toEqual(body);
    call.flush(null);
  });

  it('resets a password with the code from the email', () => {
    auth.resetPassword('a@example.com', 'code-1', 'new-password-2').subscribe();

    const call = http.expectOne('/api/v1/account/resetPassword');
    expect(call.request.body).toEqual({ email: 'a@example.com', resetCode: 'code-1', newPassword: 'new-password-2' });
    call.flush(null);
  });

  it('signs out', () => {
    auth.load().subscribe();
    answerWhoAmI('alice@example.com');

    auth.signOut().subscribe();
    http.expectOne((r) => r.url === '/api/v1/account/logout' && r.method === 'POST').flush(null, { status: 204, statusText: 'No Content' });

    expect(auth.user()).toBeNull();
  });
});
