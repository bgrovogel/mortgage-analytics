import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SignInPageComponent } from './sign-in-page.component';

describe('SignInPageComponent', () => {
  let fixture: ComponentFixture<SignInPageComponent>;
  let auth: { signIn: jest.Mock; register: jest.Mock };
  let navigate: jest.SpyInstance;

  const create = (returnUrl: string | null = null) => {
    auth = { signIn: jest.fn().mockReturnValue(of(undefined)), register: jest.fn().mockReturnValue(of(undefined)) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
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

  it('creates an account instead, when asked', () => {
    create();
    (el('account-mode-create') as HTMLButtonElement).click();
    fixture.detectChanges();
    fillIn('bob@example.com');

    submit();

    expect(el('account-submit')!.textContent!.trim()).toBe('Create account');
    expect(auth.register).toHaveBeenCalledWith('bob@example.com', 'correct-horse-1');
    expect(auth.signIn).not.toHaveBeenCalled();
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
