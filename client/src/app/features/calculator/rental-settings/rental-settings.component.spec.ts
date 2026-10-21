import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { aResponse } from '../../../../testing/builders';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { CalculatorStore } from '../calculator.store';
import { RentalSettingsComponent } from './rental-settings.component';

describe('RentalSettingsComponent', () => {
  let store: CalculatorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AmortizationApiService, useValue: { calculate: () => of(aResponse()) } }] });
    store = TestBed.inject(CalculatorStore);
  });

  const render = () => {
    const fixture = TestBed.createComponent(RentalSettingsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const box = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    const type = (id: string, value: string) => {
      box(id).value = value;
      box(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { box, type };
  };

  it('asks for the rent the home would fetch, with the usual assumptions filled in', () => {
    const { box } = render();

    expect(box('rental-rent').value).toBe('');
    expect(box('rental-vacancy').value).toBe('5');
    expect(box('rental-management').value).toBe('8');
    expect(box('rental-maintenance').value).toBe('1');
    expect(box('rental-rise').value).toBe('3');
  });

  it('measures the rental once a rent is given, and stops when it is cleared', () => {
    const { type } = render();

    type('rental-rent', '2500');
    expect(store.rentalSettings()).toEqual({ monthlyRent: 2_500, vacancyPercent: 5, managementPercent: 8, maintenancePercent: 1, rentIncreasePercent: 3 });

    type('rental-rent', '');
    expect(store.rentalSettings()).toBeNull();
  });

  it('measures it again with each assumption changed', () => {
    const { type } = render();

    type('rental-rent', '2500');
    type('rental-vacancy', '8');
    type('rental-management', '0');
    type('rental-maintenance', '1.5');
    type('rental-rise', '2');

    expect(store.rentalSettings()).toEqual({ monthlyRent: 2_500, vacancyPercent: 8, managementPercent: 0, maintenancePercent: 1.5, rentIncreasePercent: 2 });
  });

  it('does not measure it while a value is out of range', () => {
    const { type } = render();
    type('rental-rent', '2500');

    type('rental-vacancy', '51');

    expect(store.rentalSettings()?.vacancyPercent).toBe(5);
  });

  it('shows the rent a saved calculation, or a rent tried from the answer, brought', () => {
    store.rentalSettings.set({ monthlyRent: 3_100, vacancyPercent: 7, managementPercent: 10, maintenancePercent: 2, rentIncreasePercent: 4 });

    const { box } = render();

    expect(box('rental-rent').value).toBe('3,100');
    expect(box('rental-vacancy').value).toBe('7');
    expect(box('rental-management').value).toBe('10');
  });
});
