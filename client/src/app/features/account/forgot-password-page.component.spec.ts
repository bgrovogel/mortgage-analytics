import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { DevMailboxService } from '../../core/dev/dev-mailbox.service';
import { ForgotPasswordPageComponent } from './forgot-password-page.component';

describe('ForgotPasswordPageComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordPageComponent>;
  let forgotPassword: jest.Mock;

  beforeEach(() => {
    forgotPassword = jest.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { forgotPassword } },
        { provide: DevMailboxService, useValue: { available: () => of(false) } },
        { provide: ActivatedRoute, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(ForgotPasswordPageComponent);
    fixture.detectChanges();
  });

  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const send = (email: string) => {
    const box = el('forgot-email') as HTMLInputElement;
    box.value = email;
    box.dispatchEvent(new Event('input'));
    (el('forgot-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('asks for the reset email, then says it is on its way without saying whether the account exists', () => {
    send('alice@example.com');

    expect(forgotPassword).toHaveBeenCalledWith('alice@example.com');
    expect(el('forgot-sent')!.textContent).toContain('If there is an account for alice@example.com');
  });

  it('checks the address first', () => {
    send('not-an-email');

    expect(forgotPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address.');
  });

  it('says so when the server cannot be reached', () => {
    forgotPassword.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));

    send('alice@example.com');

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain("couldn't reach the server");
  });
});
