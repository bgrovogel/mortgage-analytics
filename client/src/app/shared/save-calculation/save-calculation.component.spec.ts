import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { AuthService, User } from '../../core/auth/auth.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AmortizationRequest } from '../../core/models/amortization.models';
import { SavedCalculation, SavedInputs } from '../../core/models/saved-calculation.models';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { SaveCalculationComponent } from './save-calculation.component';

describe('SaveCalculationComponent', () => {
  let fixture: ComponentFixture<SaveCalculationComponent>;
  let api: { save: jest.Mock; update: jest.Mock };
  let saved: SavedCalculation[];
  let user: ReturnType<typeof signal<User | null>>;

  const inputs = { homePrice: 375_000 } as AmortizationRequest;
  const payload: SavedInputs = { inputs };
  const savedAs = (name: string, id = 'new-id'): SavedCalculation =>
    ({ id, name, kind: 'Purchase', inputs, refinance: null, strategy: null, createdAt: '', updatedAt: '' });

  /** Creates the control the way a page uses it: what to save, a suggested name, and what it is linked to. */
  const create = (options: { payload?: SavedInputs | null; linked?: { id: string; name: string } | null } = {}) => {
    fixture = TestBed.createComponent(SaveCalculationComponent);
    fixture.componentRef.setInput('payload', options.payload === undefined ? payload : options.payload);
    fixture.componentRef.setInput('suggestion', '$375,000 home, 20% down at 6.5%');
    fixture.componentRef.setInput('linked', options.linked ?? null);
    saved = [];
    fixture.componentInstance.saved.subscribe((s) => saved.push(s));
    fixture.detectChanges();
  };

  beforeEach(() => {
    api = { save: jest.fn(), update: jest.fn() };
    user = signal<User | null>({ email: 'alice@example.com' });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SavedCalculationsApiService, useValue: api }, { provide: AuthService, useValue: { user } }],
    });
  });

  const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
  const nameBox = () => el('save-name') as HTMLInputElement;
  const click = (testId: string) => {
    el(testId)!.click();
    fixture.detectChanges();
  };
  const typeName = (name: string) => {
    nameBox().value = name;
    nameBox().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('starts closed, as a single Save button', () => {
    create();

    expect(el('save-open')!.textContent!.trim()).toBe('Save');
    expect(el('save-name')).toBeNull();
  });

  it('starts from the suggested name, ready to type over', () => {
    create();

    click('save-open');

    expect(nameBox().value).toBe('$375,000 home, 20% down at 6.5%');
    expect(document.activeElement).toBe(nameBox());
  });

  it('saves the inputs under the chosen name, reports it, and says so', () => {
    create();
    api.save.mockReturnValue(of(savedAs('Oak St')));
    click('save-open');
    typeName('  Oak St ');

    click('save-new');

    expect(api.save).toHaveBeenCalledWith('Oak St', payload);
    expect(saved.map((s) => s.name)).toEqual(['Oak St']);
    expect(el('save-name')).toBeNull();
    expect(el('save-status')!.textContent).toContain('Saved as “Oak St”');
    expect(el('save-status')!.querySelector('a')!.getAttribute('href')).toBe('/history');
  });

  it('asks for a name instead of saving a blank one', () => {
    create();
    click('save-open');
    typeName('   ');

    click('save-new');

    expect(api.save).not.toHaveBeenCalled();
    expect(el('save-error')!.textContent).toContain('Give the calculation a name.');
  });

  it('offers to update the saved calculation it is linked to, as well as saving a new one', () => {
    create({ linked: { id: 'abc', name: 'Oak St' } });
    api.update.mockReturnValue(of(savedAs('Oak St, refined', 'abc')));
    click('save-open');
    expect(nameBox().value).toBe('Oak St');
    expect(el('save-new')!.textContent!.trim()).toBe('Save as new');

    typeName('Oak St, refined');
    click('save-update');

    expect(api.update).toHaveBeenCalledWith('abc', 'Oak St, refined', payload);
    expect(saved.map((s) => s.id)).toEqual(['abc']);
    expect(el('save-status')!.textContent).toContain('Updated “Oak St, refined”');
  });

  it('shows what went wrong when the server rejects the save, and keeps the form open', () => {
    create();
    api.save.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { name: ['Too long.'] } } })));
    click('save-open');

    click('save-new');

    expect(el('save-error')!.textContent).toContain('Too long.');
    expect(el('save-name')).not.toBeNull();
  });

  it('can be cancelled', () => {
    create();
    click('save-open');

    click('save-cancel');

    expect(el('save-name')).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('cannot save before there is anything to save', () => {
    create({ payload: null });

    expect((el('save-open') as HTMLButtonElement).disabled).toBe(true);
  });

  it('asks a signed-out visitor to sign in first, and to come back here afterwards', () => {
    user.set(null);
    create();

    click('save-open');

    const prompt = el('save-sign-in')!;
    expect(prompt.textContent).toContain('Sign in to save');
    expect(prompt.querySelector('a')!.getAttribute('href')).toBe('/sign-in?returnUrl=%2F');
    expect(el('save-name')).toBeNull();
  });
});
