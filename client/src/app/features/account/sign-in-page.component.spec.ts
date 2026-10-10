import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SignInPageComponent } from './sign-in-page.component';
import { DevMailboxService } from '../../core/dev/dev-mailbox.service';

describe('SignInPageComponent', () => {
  let fixture: ComponentFixture<SignInPageComponent>;
  let auth: { signIn: jest.Mock; register: jest.Mock; resendConfirmation: jest.Mock };
  let navigate: jest.SpyInstance;

  const create = (returnUrl: string | null = null) => {
    auth = {
      signIn: jest.fn().mockReturnValue(of(undefined)),
      register: jest.fn().mockReturnValue(of(undefined)),
      resendConfirmation: jest.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
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
