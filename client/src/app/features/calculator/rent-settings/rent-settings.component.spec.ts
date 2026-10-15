import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { aResponse } from '../../../../testing/builders';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { CalculatorStore } from '../calculator.store';
import { RentSettingsComponent } from './rent-settings.component';

describe('RentSettingsComponent', () => {
  let store: CalculatorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AmortizationApiService, useValue: { calculate: () => of(aResponse()) } }] });
    store = TestBed.inject(CalculatorStore);
  });

  const render = () => {
    const fixture = TestBed.createComponent(RentSettingsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const box = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    const type = (id: string, value: string) => {
      box(id).value = value;
      box(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, box, type };
  };

  it('asks for the rent of a similar home, with the usual assumptions filled in', () => {
    const { box } = render();

    expect(box('monthly-rent').value).toBe('');
    expect(box('rent-increase').value).toBe('3.5');
    expect(box('investment-return').value).toBe('7');
    expect(box('maintenance').value).toBe('1');
    expect(box('selling-costs').value).toBe('6');
  });

  it('weighs buying against renting once a rent is given, and stops when it is cleared', () => {
    const { type } = render();

    type('monthly-rent', '2100');
    expect(store.rentSettings()).toEqual({ monthlyRent: 2_100, rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6 });

    type('monthly-rent', '');
    expect(store.rentSettings()).toBeNull();
  });

  it('does not weigh it while a value is out of range', () => {
    const { type } = render();
    type('monthly-rent', '2100');

    type('rent-increase', '45');

    expect(store.rentSettings()?.rentIncreasePercent).toBe(3.5);
  });

  it('shows a rent set from elsewhere, such as the one tried in the answer', () => {
    const { fixture, box } = render();

    store.setRentSettings({ monthlyRent: 2_700, rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6 });
    fixture.detectChanges();

    expect(box('monthly-rent').value).toBe('2,700');
  });

  it('starts from the rent already being weighed', () => {
    store.setRentSettings({ monthlyRent: 1_900, rentIncreasePercent: 2, investmentReturnPercent: 5, maintenancePercent: 1.5, sellingCostPercent: 7 });

    const { box } = render();

    expect([box('monthly-rent').value, box('rent-increase').value, box('selling-costs').value]).toEqual(['1,900', '2', '7']);
  });
});
