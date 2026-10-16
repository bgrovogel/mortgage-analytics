import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Passkey, PasskeyService } from '../../core/auth/passkey.service';
import { PasskeysComponent } from './passkeys.component';

describe('PasskeysComponent', () => {
  let fixture: ComponentFixture<PasskeysComponent>;
  let service: { supported: jest.Mock; list: jest.Mock; register: jest.Mock; remove: jest.Mock };

  const laptop: Passkey = { id: 'one', name: 'Laptop', createdAt: '2026-10-01T12:00:00Z', lastUsedAt: '2026-10-10T12:00:00Z' };
  const phone: Passkey = { id: 'two', name: 'Phone', createdAt: '2026-10-05T12:00:00Z', lastUsedAt: null };

  const create = (passkeys: Passkey[] = [laptop, phone], supported = true) => {
    service = {
      supported: jest.fn().mockReturnValue(supported),
      list: jest.fn().mockReturnValue(of(passkeys)),
      register: jest.fn().mockReturnValue(of(phone)),
      remove: jest.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: PasskeyService, useValue: service }] });
    fixture = TestBed.createComponent(PasskeysComponent);
    fixture.detectChanges();
  };
  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const text = (testId: string) => el(testId)?.textContent?.replace(/\s+/g, ' ').trim();
  const items = () => [...fixture.nativeElement.querySelectorAll('[data-testid="passkey-list"] li')]
    .map((li: HTMLElement) => [...li.querySelectorAll('strong, small')].map((e) => e.textContent!.trim()).join(' | '));
  const type = (value: string) => {
    const box = el('passkey-name') as HTMLInputElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
  };
  const add = () => {
    (el('passkey-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('lists the passkeys with when each was added and last used', () => {
    create();

    expect(items()).toEqual([
      'Laptop | Added Oct 1, 2026 · Last used Oct 10, 2026',
      'Phone | Added Oct 5, 2026 · Never used',
    ]);
  });

  it('says there are none yet', () => {
    create([]);

    expect(el('passkey-list')).toBeNull();
    expect(text('passkeys-none')).toBe('No passkeys yet.');
  });

  it('says so, and offers nothing, in a browser that cannot make them', () => {
    create([], false);

    expect(text('passkeys-unsupported')).toBe('This browser cannot make passkeys.');
    expect(el('passkey-form')).toBeNull();
  });

  describe('adding one', () => {
    it('has the device make it under the name typed, then lists it', () => {
      create([laptop]);
      service.list.mockReturnValue(of([laptop, phone]));
      type('My phone');

      add();

      expect(service.register).toHaveBeenCalledWith('My phone');
      expect(items()).toHaveLength(2);
      expect(text('passkey-status')).toBe('Passkey added.');
    });

    it('names it for the device by default, so a name is never in the way', () => {
      create([]);

      expect((el('passkey-name') as HTMLInputElement).value).toBe('This device');
    });

    it('asks for a name rather than add one with none', () => {
      create([]);
      type('   ');

      add();

      expect(service.register).not.toHaveBeenCalled();
      expect(text('passkey-name-error')).toBe('Give the passkey a name.');
    });

    it('says nothing when the person closes the device prompt', () => {
      create([]);
      service.register.mockReturnValue(of(null));

      add();

      expect(el('passkey-status')).toBeNull();
      expect(el('passkey-error')).toBeNull();
      expect(service.list).toHaveBeenCalledTimes(1);
    });

    it('says why when the API refuses', () => {
      create([]);
      service.register.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { title: 'You can have up to 10 passkeys. Remove one to add another.' } })));

      add();

      expect(text('passkey-error')).toBe('You can have up to 10 passkeys. Remove one to add another.');
    });
  });

  it('removes a passkey and no longer lists it', () => {
    create();
    service.list.mockReturnValue(of([phone]));

    (fixture.nativeElement.querySelector('[aria-label="Remove Laptop"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(service.remove).toHaveBeenCalledWith('one');
    expect(items()).toEqual(['Phone | Added Oct 5, 2026 · Never used']);
    expect(text('passkey-status')).toBe('Laptop removed.');
  });
});
