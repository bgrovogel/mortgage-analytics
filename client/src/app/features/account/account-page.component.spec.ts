import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService, User } from '../../core/auth/auth.service';
import { CalculatorStore } from '../calculator/calculator.store';
import { AccountPageComponent } from './account-page.component';

describe('AccountPageComponent', () => {
  let fixture: ComponentFixture<AccountPageComponent>;
  let deleteAccount: jest.Mock;

  beforeEach(() => {
    deleteAccount = jest.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal<User | null>({ email: 'alice@example.com' }), deleteAccount } },
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
});
