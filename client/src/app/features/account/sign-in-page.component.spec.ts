import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { PasskeyService } from '../../core/auth/passkey.service';
import { SignInPageComponent } from './sign-in-page.component';
import { DevMailboxService } from '../../core/dev/dev-mailbox.service';

describe('SignInPageComponent', () => {
  let fixture: ComponentFixture<SignInPageComponent>;
  let auth: { signIn: jest.Mock; register: jest.Mock; resendConfirmation: jest.Mock };
  let navigate: jest.SpyInstance;
  let passkeys: { supported: jest.Mock; signIn: jest.Mock };

  const create = (returnUrl: string | null = null, canDoPasskeys = true) => {
    passkeys = { supported: jest.fn().mockReturnValue(canDoPasskeys), signIn: jest.fn().mockReturnValue(of('signed-in')) };
    auth = {
      signIn: jest.fn().mockReturnValue(of(undefined)),
      register: jest.fn().mockReturnValue(of(undefined)),
      resendConfirmation: jest.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: PasskeyService, useValue: passkeys },
        { provide: DevMailboxService, useValue: { available: () => of(true) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) } } },
      ],
    });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SignInPageComponent);
    fixture.detectChanges();
  };

  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const type = (testId: string, value: string) => {
    const box = el(testId) as HTMLInputElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
  };
  const submit = () => {
    (el('account-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const fillIn = (email = 'alice@example.com', password = 'correct-horse-1') => {
    type('account-email', email);
    type('account-password', password);
  };

  it('says what an account is for, and that the calculators never need one', () => {
    create();

    const benefits = el('account-benefits')!.textContent!.replace(/\s+/g, ' ');
    expect(benefits).toContain('Save any calculation');
    expect(benefits).toContain('Private to you');
    expect(benefits).toContain('passkey');
    expect(benefits).toContain('The calculators never need an account.');
  });

  describe('with a passkey', () => {
    it('offers to sign in with one, below the password form', () => {
      create();

      expect(el('passkey-sign-in')!.textContent!.trim()).toBe('Sign in with a passkey');
    });

    it('offers nothing a browser cannot do, nor when creating an account', () => {
      create(null, false);
      expect(el('passkey-sign-in')).toBeNull();

      TestBed.resetTestingModule();
      create();
      (el('account-mode-create') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el('passkey-sign-in')).toBeNull();
    });

    it('signs in with it and goes back to where the person was heading, with no password asked', () => {
      create('/calculator/schedule');

      (el('passkey-sign-in') as HTMLButtonElement).click();

      expect(passkeys.signIn).toHaveBeenCalledTimes(1);
      expect(auth.signIn).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/calculator/schedule');
    });

    it('stays where it is, saying nothing, when the person closes the device prompt', () => {
      create();
      passkeys.signIn.mockReturnValue(of('cancelled'));

      (el('passkey-sign-in') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(navigate).not.toHaveBeenCalled();
      expect(el('account-error')).toBeNull();
    });

    it('says so, and points to the password, when the API refuses the passkey', () => {
      create();
      passkeys.signIn.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { title: 'no' } })));

      (el('passkey-sign-in') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el('account-error')!.textContent).toContain('That passkey could not sign you in. Try your password instead.');
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('signs in and goes back to where the user was heading', () => {
    create('/calculator/schedule');
    fillIn();

    submit();

    expect(auth.signIn).toHaveBeenCalledWith('alice@example.com', 'correct-horse-1');
    expect(navigate).toHaveBeenCalledWith('/calculator/schedule');
  });

  it('goes to History when there is nowhere (safe) to go back to', () => {
    create('https://evil.example');
    fillIn();

    submit();

    expect(navigate).toHaveBeenCalledWith('/history');
  });

  it('says plainly when the email and password do not match', () => {
    create();
    auth.signIn.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { title: 'Unauthorized', detail: 'Failed' } })));
    fillIn();

    submit();

    expect(el('account-error')!.textContent).toContain('That email and password do not match.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('creates an account instead, when asked, then asks the user to check their email', () => {
    create();
    (el('account-mode-create') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el('account-submit')!.textContent!.trim()).toBe('Create account');
    fillIn('bob@example.com');

    submit();

    expect(auth.register).toHaveBeenCalledWith('bob@example.com', 'correct-horse-1');
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(el('account-check-email')!.textContent).toContain('we sent a link to bob@example.com');
    expect(el('dev-mailbox-hint')).not.toBeNull();
  });

  it('can send the confirmation link again', () => {
    create();
    (el('account-mode-create') as HTMLButtonElement).click();
    fixture.detectChanges();
    fillIn('bob@example.com');
    submit();

    (el('account-resend') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(auth.resendConfirmation).toHaveBeenCalledWith('bob@example.com');
    expect(el('account-resent')!.textContent).toContain('We sent the link again.');
  });

  it('explains an unconfirmed email, and offers to send the link again', () => {
    create();
    auth.signIn.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { detail: 'NotAllowed' } })));
    fillIn();

    submit();
    (el('account-resend') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el('account-error')!.textContent).toContain('Confirm your email first');
    expect(auth.resendConfirmation).toHaveBeenCalledWith('alice@example.com');
  });

  it('links to the forgotten-password page', () => {
    create();

    expect(el('forgot-password-link')!.getAttribute('href')).toBe('/forgot-password');
  });

  it('shows the rules a new password breaks, as the server words them', () => {
    create();
    (el('account-mode-create') as HTMLButtonElement).click();
    auth.register.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { errors: { PasswordRequiresDigit: ['Passwords must have at least one digit (0-9).'] } },
    })));
    fillIn('bob@example.com'); // passes the client's checks; the server has the final say

    submit();

    expect(el('account-error')!.textContent).toContain('Passwords must have at least one digit');
  });

  it('checks the email and password before sending anything', () => {
    create();
    fillIn('not-an-email', 'short');

    submit();

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
    expect(fixture.nativeElement.textContent).toContain('At least 8 characters, with a number.');
  });
});
