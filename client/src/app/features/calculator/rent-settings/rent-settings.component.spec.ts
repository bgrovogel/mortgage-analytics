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

  describe('the tax savings of owning', () => {
    const settings = { monthlyRent: 2_100, rentIncreasePercent: 3.5, investmentReturnPercent: 7, maintenancePercent: 1, sellingCostPercent: 6 };

    it('are left out until asked for, with their boxes out of the way', () => {
      const { box } = render();

      expect((box('count-tax') as HTMLInputElement).checked).toBe(false);
      expect(box('filing-status')).toBeNull();
      expect(box('tax-rate')).toBeNull();
    });

    it('are counted once asked for, for a single filer at 24% to start, and the boxes appear', () => {
      const { fixture, box, type } = render();
      type('monthly-rent', '2100');

      (box('count-tax') as HTMLInputElement).click();
      fixture.detectChanges();

      expect(store.rentSettings()).toEqual({ ...settings, ownerTaxes: { filingStatus: 'Single', marginalTaxRatePercent: 24, otherStateAndLocalTaxes: 0, otherItemizedDeductions: 0 } });
      expect(box('tax-rate').value).toBe('24');
    });

    it('follow what is typed: the filing status, the rate and the other deductions', () => {
      const { fixture, box, type } = render();
      type('monthly-rent', '2100');
      (box('count-tax') as HTMLInputElement).click();
      fixture.detectChanges();

      const status = box('filing-status') as unknown as HTMLSelectElement;
      status.value = 'MarriedFilingJointly';
      status.dispatchEvent(new Event('change'));
      type('tax-rate', '32');
      type('other-state-local-taxes', '12000');
      type('other-deductions', '5000');

      expect(store.rentSettings()?.ownerTaxes).toEqual({ filingStatus: 'MarriedFilingJointly', marginalTaxRatePercent: 32, otherStateAndLocalTaxes: 12_000, otherItemizedDeductions: 5_000 });
    });

    it('are left out again when the box is unticked', () => {
      const { fixture, box, type } = render();
      type('monthly-rent', '2100');
      (box('count-tax') as HTMLInputElement).click();
      fixture.detectChanges();

      (box('count-tax') as HTMLInputElement).click();
      fixture.detectChanges();

      expect(store.rentSettings()).toEqual(settings);
      expect(box('tax-rate')).toBeNull();
    });

    it('are not counted while a value is out of range', () => {
      const { fixture, box, type } = render();
      type('monthly-rent', '2100');
      (box('count-tax') as HTMLInputElement).click();
      fixture.detectChanges();

      type('tax-rate', '51');

      expect(store.rentSettings()?.ownerTaxes?.marginalTaxRatePercent).toBe(24);
    });

    it('show a saved calculation that counted them, ticked, with its figures', () => {
      store.setRentSettings({ ...settings, ownerTaxes: { filingStatus: 'HeadOfHousehold', marginalTaxRatePercent: 35, otherStateAndLocalTaxes: 9_000, otherItemizedDeductions: 0 } });

      const { box } = render();

      expect((box('count-tax') as HTMLInputElement).checked).toBe(true);
      expect((box('filing-status') as unknown as HTMLSelectElement).value).toBe('HeadOfHousehold');
      expect(box('tax-rate').value).toBe('35');
      expect(box('other-state-local-taxes').value).toBe('9,000');
    });
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
