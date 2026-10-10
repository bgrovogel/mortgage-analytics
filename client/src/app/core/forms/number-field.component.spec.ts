import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { FieldRule, validatorsFor } from './field-rules';
import { NumberFieldComponent } from './number-field.component';

const RATE: FieldRule = { label: 'Interest rate', unit: '%', min: 0, max: 30, decimals: 4 };
const PRICE: FieldRule = { label: 'Home price', unit: '$', min: 0.01 };

@Component({
  imports: [NumberFieldComponent],
  template: `
    <app-number-field [control]="rate" [rule]="rateRule" testId="rate" />
    <app-number-field [control]="price" [rule]="priceRule" testId="price" label="Price you pay" />
    <app-number-field [control]="rate" [rule]="rateRule" testId="mud"><abbr title="Municipal Utility District">MUD</abbr></app-number-field>
  `,
})
class HostComponent {
  readonly rate = new FormControl<number | null>(6.5, validatorsFor(RATE));
  readonly price = new FormControl<number | null>(375_000, validatorsFor(PRICE));
  readonly rateRule = RATE;
  readonly priceRule = PRICE;
}

describe('NumberFieldComponent', () => {
  const render = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const box = (id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    const field = (id: string) => box(id).closest('label')!;
    return { fixture, root, box, field };
  };

  it("labels the box with the rule's label, a label of its own, or projected content", () => {
    const { field } = render();

    expect(field('rate').querySelector('span')!.textContent!.trim()).toBe('Interest rate');
    expect(field('price').querySelector('span')!.textContent!.trim()).toBe('Price you pay');
    expect(field('mud').querySelector('abbr')!.title).toBe('Municipal Utility District');
  });

  it('puts "$" before money and "%" after rates, and shows as many decimals as the rule allows', () => {
    const { field, box, fixture } = render();
    fixture.componentInstance.rate.setValue(6.125);
    fixture.detectChanges();

    expect(field('price').querySelector('.affix')!.getAttribute('data-prefix')).toBe('$');
    expect(field('rate').querySelector('.affix')!.getAttribute('data-suffix')).toBe('%');
    expect(box('price').value).toBe('375,000');
    expect(box('rate').value).toBe('6.125');
  });

  it('says what is wrong once the value has been changed, and marks the box invalid', () => {
    const { root, box, fixture } = render();
    expect(root.querySelector('[data-testid="error-rate"]')).toBeNull();

    box('rate').dispatchEvent(new Event('focus'));
    box('rate').value = '45';
    box('rate').dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="error-rate"]')!.textContent).toBe('Interest rate must be between 0% and 30%.');
    expect(box('rate').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows an error that appears without typing, e.g. when the whole form is marked as touched', () => {
    const { root, fixture } = render();

    fixture.componentInstance.price.setValue(0);
    fixture.componentInstance.price.markAsTouched();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="error-price"]')!.textContent).toBe('Home price must be more than $0.');
  });
});
