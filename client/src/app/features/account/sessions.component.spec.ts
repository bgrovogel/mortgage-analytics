import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SessionsApiService, UserSession } from '../../core/services/sessions-api.service';
import { SessionsComponent } from './sessions.component';

describe('SessionsComponent', () => {
  let fixture: ComponentFixture<SessionsComponent>;
  let api: { list: jest.Mock; end: jest.Mock; endOthers: jest.Mock };

  const laptop: UserSession = { id: 'one', device: 'Chrome on Windows', createdAt: '2026-10-01T12:00:00Z', lastSeenAt: '2026-10-21T12:00:00Z', current: true };
  const phone: UserSession = { id: 'two', device: 'Safari on iPhone', createdAt: '2026-10-05T12:00:00Z', lastSeenAt: '2026-10-20T12:00:00Z', current: false };
  const tablet: UserSession = { id: 'three', device: 'Chrome on Android', createdAt: '2026-10-07T12:00:00Z', lastSeenAt: '2026-10-19T12:00:00Z', current: false };

  const create = (sessions: UserSession[] = [laptop, phone]) => {
    api = {
      list: jest.fn().mockReturnValue(of(sessions)),
      end: jest.fn().mockReturnValue(of(undefined)),
      endOthers: jest.fn().mockReturnValue(of({ ended: 1 })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: SessionsApiService, useValue: api }] });
    fixture = TestBed.createComponent(SessionsComponent);
    fixture.detectChanges();
  };
  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const text = (testId: string) => el(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const items = () => [...fixture.nativeElement.querySelectorAll('[data-testid="session-list"] li')]
    .map((li: HTMLElement) => li.textContent!.replace(/\s+/g, ' ').trim());
  const button = (name: string) => fixture.nativeElement.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;

  it('lists each place the account is signed in, with when it began and was last used, and marks this one', () => {
    create();

    expect(items()).toEqual([
      expect.stringContaining('Chrome on WindowsThis deviceSigned in Oct 1, 2026 · Last active Oct 21,'),
      expect.stringContaining('Safari on iPhoneSigned in Oct 5, 2026 · Last active Oct 20,'),
    ]);
    expect(el('session-current')).not.toBeNull();
  });

  it('offers to sign out each of the others, and not this one', () => {
    create();

    expect(button('Sign out Safari on iPhone')).not.toBeNull();
    expect(button('Sign out Chrome on Windows')).toBeNull();
  });

  it('signs a device out, says so, and lists again', () => {
    create();
    api.list.mockReturnValue(of([laptop]));

    button('Sign out Safari on iPhone').click();
    fixture.detectChanges();

    expect(api.end).toHaveBeenCalledWith('two');
    expect(text('sessions-status')).toBe('Safari on iPhone signed out.');
    expect(items()).toHaveLength(1);
  });

  it('signs out everywhere else, once there is somewhere else, and says how many', () => {
    create([laptop, phone, tablet]);
    api.endOthers.mockReturnValue(of({ ended: 2 }));
    api.list.mockReturnValue(of([laptop]));

    el('sessions-end-others')!.click();
    fixture.detectChanges();

    expect(api.endOthers).toHaveBeenCalled();
    expect(text('sessions-status')).toBe('2 other devices signed out.');
    expect(el('sessions-end-others')).toBeNull();
  });

  it('has no sign out everywhere else when there is nowhere else', () => {
    create([laptop]);

    expect(el('sessions-end-others')).toBeNull();
  });

  it('says so when the account has no listed session, as with a sign-in from before they were listed', () => {
    create([]);

    expect(text('sessions-none')).toContain('Signed in on this device only');
  });

  it('shows why an action failed', () => {
    create();
    api.end.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { title: 'Not found.' } })));

    button('Sign out Safari on iPhone').click();
    fixture.detectChanges();

    expect(text('sessions-error')).toBeTruthy();
  });
});
