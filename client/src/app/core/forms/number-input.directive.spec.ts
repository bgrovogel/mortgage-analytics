import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NumberInputDirective } from './number-input.directive';

@Component({
  imports: [ReactiveFormsModule, NumberInputDirective],
  template: `
    <input data-testid="money" appNumber [formControl]="money" />
    <input data-testid="rate" appNumber [decimals]="4" [formControl]="rate" />
  `,
})
class HostComponent {
  readonly money = new FormControl<number | null>(375_000, Validators.min(0));
  readonly rate = new FormControl<number | null>(6.875);
}

describe('NumberInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const input = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
  const type = (testId: string, text: string) => {
    const el = input(testId);
    el.dispatchEvent(new Event('focus'));
    el.value = text;
    el.dispatchEvent(new Event('input'));
  };
  const blur = (testId: string) => input(testId).dispatchEvent(new Event('blur'));

  it('shows thousands separators while not being edited', () => {
    expect(input('money').value).toBe('375,000');
  });

  it('is a text box, so browsers show no spinner arrows', () => {
    expect(input('money').type).toBe('text');
    expect(input('money').inputMode).toBe('decimal');
  });

  it('shows the plain number while editing, so the caret never jumps around commas', () => {
    input('money').dispatchEvent(new Event('focus'));

    expect(input('money').value).toBe('375000');
  });

  it('selects the whole number on focus, so typing replaces it instead of appending to it', () => {
    input('money').dispatchEvent(new Event('focus'));

    // Swapping "375,000" for "375000" would otherwise drop the selection and park the caret at the end.
    expect([input('money').selectionStart, input('money').selectionEnd]).toEqual([0, '375000'.length]);
  });

  it('reads what was typed, ignoring commas and a dollar sign', () => {
    type('money', '$1,234.5');

    expect(host.money.value).toBe(1_234.5);
  });

  it('formats again when editing ends, and marks the control touched', () => {
    type('money', '250000');
    blur('money');

    expect(input('money').value).toBe('250,000');
    expect(host.money.touched).toBe(true);
  });

  it('keeps up to the configured number of decimals when formatting', () => {
    expect(input('rate').value).toBe('6.875');
  });

  it('treats an empty box as no value', () => {
    type('money', '');

    expect(host.money.value).toBeNull();
  });

  it('flags text that is not a number as invalid, instead of silently using 0', () => {
    type('money', '12abc');

    expect(host.money.value).toBeNull();
    expect(host.money.hasError('number')).toBe(true);
  });

  it('follows values set from code', () => {
    host.money.setValue(18_750);

    expect(input('money').value).toBe('18,750');
  });

  it('can be disabled', () => {
    host.money.disable();

    expect(input('money').disabled).toBe(true);
  });
});
