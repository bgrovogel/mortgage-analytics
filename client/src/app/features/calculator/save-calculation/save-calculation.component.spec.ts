import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { AmortizationRequest } from '../../../core/models/amortization.models';
import { SavedCalculation } from '../../../core/models/saved-calculation.models';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { SavedCalculationsApiService } from '../../../core/services/saved-calculations-api.service';
import { CalculatorStore } from '../calculator.store';
import { SaveCalculationComponent } from './save-calculation.component';

describe('SaveCalculationComponent', () => {
  let fixture: ComponentFixture<SaveCalculationComponent>;
  let store: CalculatorStore;
  let api: { save: jest.Mock; update: jest.Mock };

  const inputs = { homePrice: 375_000, downPayment: 75_000, annualInterestRate: 6.5 } as AmortizationRequest;
  const savedAs = (name: string, id = 'new-id'): SavedCalculation => ({ id, name, inputs, createdAt: '', updatedAt: '' });

  beforeEach(() => {
    api = { save: jest.fn(), update: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SavedCalculationsApiService, useValue: api },
        { provide: AmortizationApiService, useValue: { calculate: () => NEVER } },
      ],
    });
    store = TestBed.inject(CalculatorStore);
    fixture = TestBed.createComponent(SaveCalculationComponent);
    store.calculate(inputs); // the request is remembered at once; the (never-answered) call does not matter
    fixture.detectChanges();
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
    expect(el('save-open')!.textContent!.trim()).toBe('Save');
    expect(el('save-name')).toBeNull();
  });

  it('suggests a name built from the loan', () => {
    click('save-open');

    expect(nameBox().value).toBe('$375,000 home, 20% down at 6.5%');
    expect(document.activeElement).toBe(nameBox());
  });

  it('saves under the chosen name, links the calculator to it, and says so', () => {
    api.save.mockReturnValue(of(savedAs('Oak St')));
    click('save-open');
    typeName('  Oak St ');

    click('save-new');

    expect(api.save).toHaveBeenCalledWith('Oak St', inputs);
    expect(store.saved()).toEqual({ id: 'new-id', name: 'Oak St' });
    expect(el('save-name')).toBeNull();
    expect(el('save-status')!.textContent).toContain('Saved as “Oak St”');
    expect(el('save-status')!.querySelector('a')!.getAttribute('href')).toBe('/history');
  });

  it('asks for a name instead of saving a blank one', () => {
    click('save-open');
    typeName('   ');

    click('save-new');

    expect(api.save).not.toHaveBeenCalled();
    expect(el('save-error')!.textContent).toContain('Give the calculation a name.');
  });

  it('offers to update the saved calculation it came from, as well as saving a new one', () => {
    store.linkTo({ id: 'abc', name: 'Oak St' });
    api.update.mockReturnValue(of(savedAs('Oak St, refined', 'abc')));
    fixture.detectChanges();
    click('save-open');
    expect(nameBox().value).toBe('Oak St');
    expect(el('save-new')!.textContent!.trim()).toBe('Save as new');

    typeName('Oak St, refined');
    click('save-update');

    expect(api.update).toHaveBeenCalledWith('abc', 'Oak St, refined', inputs);
    expect(store.saved()).toEqual({ id: 'abc', name: 'Oak St, refined' });
    expect(el('save-status')!.textContent).toContain('Updated “Oak St, refined”');
  });

  it('shows what went wrong when the server rejects the save, and keeps the form open', () => {
    api.save.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { name: ['Too long.'] } } })));
    click('save-open');

    click('save-new');

    expect(el('save-error')!.textContent).toContain('Too long.');
    expect(el('save-name')).not.toBeNull();
  });

  it('can be cancelled', () => {
    click('save-open');

    click('save-cancel');

    expect(el('save-name')).toBeNull();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('cannot save before there is anything to save', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SavedCalculationsApiService, useValue: api }, { provide: AmortizationApiService, useValue: {} }],
    });
    const fresh = TestBed.createComponent(SaveCalculationComponent);
    fresh.detectChanges();

    expect((fresh.nativeElement.querySelector('[data-testid="save-open"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
