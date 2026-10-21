import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService, User } from '../../core/auth/auth.service';
import { PasskeyService } from '../../core/auth/passkey.service';
import { AccountExportService } from '../../core/services/account-export.service';
import { CalculatorStore } from '../calculator/calculator.store';
import { AccountPageComponent } from './account-page.component';

describe('AccountPageComponent', () => {
  let fixture: ComponentFixture<AccountPageComponent>;
  let deleteAccount: jest.Mock;
  let changePassword: jest.Mock;

  beforeEach(() => {
    deleteAccount = jest.fn().mockReturnValue(of(undefined));
    changePassword = jest.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal<User | null>({ email: 'alice@example.com' }), deleteAccount, changePassword } },
        { provide: PasskeyService, useValue: { supported: () => false } },
        { provide: AccountExportService, useValue: { download: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();
  });

  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const click = (testId: string) => {
    el(testId)!.click();
    fixture.detectChanges();
  };
  const confirmWith = (password: string) => {
    click('delete-start');
    const box = el('delete-password') as HTMLInputElement;
    box.value = password;
    box.dispatchEvent(new Event('input'));
    (el('delete-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('has a place for passkeys between the password and deleting the account', () => {
    expect(fixture.nativeElement.querySelector('app-passkeys')).not.toBeNull();
  });

  it('says which account is signed in', () => {
    expect(el('account-page-email')!.textContent).toContain('alice@example.com');
  });

  it('asks for the password before deleting anything', () => {
    expect(el('delete-form')).toBeNull();

    click('delete-start');

    expect(el('delete-form')).not.toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('can be called off, deleting nothing', () => {
    click('delete-start');

    click('delete-cancel');

    expect(el('delete-form')).toBeNull();
    expect(el('delete-start')).not.toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('needs a password to be typed', () => {
    confirmWith('');

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter your password.');
  });

  it('deletes the account with the password, says so, and unlinks the pages from its saves', () => {
    TestBed.inject(CalculatorStore).linkTo({ id: 'c1', name: 'Oak St' });

    confirmWith('correct-horse-1');

    expect(deleteAccount).toHaveBeenCalledWith('correct-horse-1');
    expect(el('delete-done')!.textContent).toContain('Your account is deleted');
    expect(el('delete-form')).toBeNull();
    expect(TestBed.inject(CalculatorStore).saved()).toBeNull();
  });

  it('shows why the server refused, and keeps the form for another try', () => {
    deleteAccount.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { errors: { password: ['The password is not correct.'] } },
    })));

    confirmWith('wrong-password-1');

    expect(el('delete-error')!.textContent).toContain('The password is not correct.');
    expect(el('delete-form')).not.toBeNull();
    expect(el('delete-done')).toBeNull();
  });

  it('cannot be sent twice while the first is on its way', () => {
    deleteAccount.mockReturnValue(new Subject<void>());

    confirmWith('correct-horse-1');

    expect((el('delete-submit') as HTMLButtonElement).disabled).toBe(true);
    expect((el('delete-cancel') as HTMLButtonElement).disabled).toBe(true);
  });

  describe('changing the password', () => {
    const type = (testId: string, value: string) => {
      const box = el(testId) as HTMLInputElement;
      box.value = value;
      box.dispatchEvent(new Event('input'));
    };
    const change = (current: string, next: string) => {
      type('current-password', current);
      type('new-password', next);
      (el('password-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };

    it('changes it with the current one, says so, and clears the form', () => {
      change('correct-horse-1', 'brand-new-password-2');

      expect(changePassword).toHaveBeenCalledWith('correct-horse-1', 'brand-new-password-2');
      expect(el('password-changed')!.textContent).toContain('Your password is changed');
      expect((el('current-password') as HTMLInputElement).value).toBe('');
      expect((el('new-password') as HTMLInputElement).value).toBe('');
    });

    it('checks the new password against the rules first', () => {
      change('correct-horse-1', 'short');

      expect(changePassword).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('At least 8 characters, with a number.');
    });

    it('shows why the server refused, and keeps what was typed', () => {
      changePassword.mockReturnValue(throwError(() => new HttpErrorResponse({
        status: 400, error: { errors: { currentPassword: ['The password is not correct.'] } },
      })));

      change('wrong-password-1', 'brand-new-password-2');

      expect(el('password-error')!.textContent).toContain('The password is not correct.');
      expect(el('password-changed')).toBeNull();
      expect((el('new-password') as HTMLInputElement).value).toBe('brand-new-password-2');
    });

    it('cannot be sent twice while the first is on its way', () => {
      changePassword.mockReturnValue(new Subject<void>());

      change('correct-horse-1', 'brand-new-password-2');

      expect((el('password-submit') as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
