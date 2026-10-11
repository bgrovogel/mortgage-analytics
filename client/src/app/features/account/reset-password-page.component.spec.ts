import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ResetPasswordPageComponent } from './reset-password-page.component';

describe('ResetPasswordPageComponent', () => {
  let fixture: ComponentFixture<ResetPasswordPageComponent>;
  let resetPassword: jest.Mock;

  const open = (query: Record<string, string>) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { resetPassword } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();
  };
  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const choose = (password: string) => {
    const box = el('reset-password') as HTMLInputElement;
    box.value = password;
    box.dispatchEvent(new Event('input'));
    (el('reset-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(() => (resetPassword = jest.fn().mockReturnValue(of(undefined))));

  it('sets the new password with the email and code from the link', () => {
    open({ email: 'alice@example.com', code: 'c1' });

    choose('brand-new-password-2');

    expect(resetPassword).toHaveBeenCalledWith('alice@example.com', 'c1', 'brand-new-password-2');
    expect(el('reset-done')!.textContent).toContain('Your password is changed.');
  });

  it('checks the new password against the rules first', () => {
    open({ email: 'alice@example.com', code: 'c1' });

    choose('short');

    expect(resetPassword).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('At least 8 characters, with a number.');
  });

  it('offers a new link when the code is refused', () => {
    open({ email: 'alice@example.com', code: 'used' });
    resetPassword.mockReturnValue(throwError(() => new Error('400')));

    choose('brand-new-password-2');

    expect(el('reset-invalid')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  it('treats an incomplete link as invalid from the start', () => {
    open({ email: 'alice@example.com' });

    expect(el('reset-invalid')).not.toBeNull();
    expect(el('reset-form')).toBeNull();
  });
});
