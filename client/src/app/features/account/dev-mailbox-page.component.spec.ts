import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DevMailboxService, OutboxEmail } from '../../core/dev/dev-mailbox.service';
import { DevMailboxHintComponent } from './dev-mailbox-hint.component';
import { DevMailboxPageComponent } from './dev-mailbox-page.component';
import { provideRouter } from '@angular/router';

describe('DevMailboxPageComponent', () => {
  let fixture: ComponentFixture<DevMailboxPageComponent>;
  let list: jest.Mock;
  let clear: jest.Mock;

  beforeEach(() => (clear = jest.fn().mockReturnValue(of(undefined))));

  const email = (subject: string): OutboxEmail => ({
    to: 'alice@example.com', subject, text: '', html: '', actionUrl: 'http://localhost:4200/confirm-email?userId=u&code=c', sentAt: '2026-10-10T12:00:00Z',
  });
  const open = () => {
    TestBed.configureTestingModule({ providers: [{ provide: DevMailboxService, useValue: { list, clear } }] });
    fixture = TestBed.createComponent(DevMailboxPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('lists the sent emails, each with its link to follow', () => {
    list = jest.fn().mockReturnValue(of([email('Confirm your email for Mortgage Analytics')]));

    const page = open();
    const item = page.querySelector('[data-testid="mailbox-email"]')!;

    expect(item.textContent).toContain('Confirm your email for Mortgage Analytics');
    expect(item.textContent).toContain('alice@example.com');
    expect(item.querySelector('a')!.getAttribute('href')).toBe('http://localhost:4200/confirm-email?userId=u&code=c');
  });

  it('says when nothing has been sent yet, and can look again', () => {
    list = jest.fn().mockReturnValue(of([]));
    const page = open();
    expect(page.querySelector('[data-testid="mailbox-empty"]')).not.toBeNull();

    list.mockReturnValue(of([email('Reset your Mortgage Analytics password')]));
    (page.querySelector('[data-testid="mailbox-refresh"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(page.querySelectorAll('[data-testid="mailbox-email"]')).toHaveLength(1);
  });

  it('can be emptied before a demo', () => {
    list = jest.fn().mockReturnValue(of([email('Confirm your email for Mortgage Analytics')]));
    const page = open();
    list.mockReturnValue(of([]));

    (page.querySelector('[data-testid="mailbox-clear"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(clear).toHaveBeenCalled();
    expect(page.querySelector('[data-testid="mailbox-empty"]')).not.toBeNull();
  });

  it('explains that the mailbox exists only in Development', () => {
    list = jest.fn().mockReturnValue(of(null));

    expect(open().querySelector('[data-testid="mailbox-unavailable"]')!.textContent).toContain('only while the API runs in Development');
  });
});

describe('DevMailboxHintComponent', () => {
  const render = (available: boolean) => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: DevMailboxService, useValue: { available: () => of(available) } }] });
    const fixture = TestBed.createComponent(DevMailboxHintComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('points to the dev mailbox when there is one', () => {
    expect(render(true).querySelector('a')!.getAttribute('href')).toBe('/dev/mailbox');
  });

  it('stays hidden otherwise', () => {
    expect(render(false).textContent!.trim()).toBe('');
  });
});
