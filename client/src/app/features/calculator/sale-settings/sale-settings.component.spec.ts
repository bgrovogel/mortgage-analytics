import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { aResponse } from '../../../../testing/builders';
import { AmortizationApiService } from '../../../core/services/amortization-api.service';
import { CalculatorStore } from '../calculator.store';
import { SaleSettingsComponent } from './sale-settings.component';

describe('SaleSettingsComponent', () => {
  let store: CalculatorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: AmortizationApiService, useValue: { calculate: () => of(aResponse()) } }] });
    store = TestBed.inject(CalculatorStore);
  });

  const render = () => {
    const fixture = TestBed.createComponent(SaleSettingsComponent);
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

  it('starts with the usual costs and tax rate, for a single filer', () => {
    const { box } = render();

    expect(box('sale-costs').value).toBe('6');
    expect(box('sale-tax-rate').value).toBe('15');
    expect((box('sale-filing-status') as unknown as HTMLSelectElement).value).toBe('Single');
  });

  it('asks how far prices might fall, and works the sale out under that fall and under flat prices', () => {
    const { box, type } = render();
    expect(box('sale-price-fall').value).toBe('3');
    expect(store.saleSettings().valueChangesPercent).toEqual([-3, 0]);

    type('sale-price-fall', '5');
    expect(store.saleSettings().valueChangesPercent).toEqual([-5, 0]);

    type('sale-price-fall', '0');
    expect(store.saleSettings().valueChangesPercent).toEqual([0]); // flat is already the only other case
  });

  it('does not work it out while the fall is out of range', () => {
    const { type } = render();
    type('sale-price-fall', '25');

    expect(store.saleSettings().valueChangesPercent).toEqual([-3, 0]);
  });

  it('works the sale out again with what is typed', () => {
    const { fixture, box, type } = render();

    type('sale-costs', '8');
    type('sale-tax-rate', '20');
    const status = box('sale-filing-status') as unknown as HTMLSelectElement;
    status.value = 'MarriedFilingJointly';
    status.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(store.saleSettings()).toEqual({ sellingCostPercent: 8, filingStatus: 'MarriedFilingJointly', gainsTaxRatePercent: 20, valueChangesPercent: [-3, 0] });
  });

  it('does not work it out while a value is out of range', () => {
    const { type } = render();

    type('sale-costs', '21');
    type('sale-tax-rate', '41');

    expect(store.saleSettings()).toEqual({ sellingCostPercent: 6, filingStatus: 'Single', gainsTaxRatePercent: 15, valueChangesPercent: [-3, 0] });
  });

  it('shows the settings of a saved calculation', () => {
    store.saleSettings.set({ sellingCostPercent: 7.5, filingStatus: 'HeadOfHousehold', gainsTaxRatePercent: 23.8 });

    const { box } = render();

    expect(box('sale-costs').value).toBe('7.5');
    expect(box('sale-tax-rate').value).toBe('23.8');
    expect((box('sale-filing-status') as unknown as HTMLSelectElement).value).toBe('HeadOfHousehold');
  });
});
