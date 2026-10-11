import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmEmailPageComponent } from './confirm-email-page.component';

describe('ConfirmEmailPageComponent', () => {
  let fixture: ComponentFixture<ConfirmEmailPageComponent>;
  let confirmEmail: jest.Mock;

  const open = (query: Record<string, string>) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { confirmEmail } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    fixture = TestBed.createComponent(ConfirmEmailPageComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!;
  };

  beforeEach(() => (confirmEmail = jest.fn().mockReturnValue(of(undefined))));

  it('confirms with the user id and code from the link, then offers to sign in', () => {
    const text = open({ userId: 'u1', code: 'c1' });

    expect(confirmEmail).toHaveBeenCalledWith('u1', 'c1', null);
    expect(text).toContain('Your email is confirmed');
    expect(fixture.nativeElement.querySelector('a.primary').getAttribute('href')).toBe('/sign-in');
  });

  it('passes a changed email along', () => {
    open({ userId: 'u1', code: 'c1', changedEmail: 'new@example.com' });

    expect(confirmEmail).toHaveBeenCalledWith('u1', 'c1', 'new@example.com');
  });

  it('says when the link does not work', () => {
    confirmEmail.mockReturnValue(throwError(() => new Error('401')));

    expect(open({ userId: 'u1', code: 'bad' })).toContain('That link did not work');
  });

  it('does not even try with an incomplete link', () => {
    const text = open({ userId: 'u1' });

    expect(confirmEmail).not.toHaveBeenCalled();
    expect(text).toContain('That link did not work');
  });
});
