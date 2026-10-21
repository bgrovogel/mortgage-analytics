import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ControlContainer, FormControl, FormGroup, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { FieldRules, MAX_AMOUNT, validatorsFor } from '../../../../core/forms/field-rules';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { LOAN_FORM } from '../loan-form.token';
import { TPipe } from '../../../../core/i18n/t.pipe';
import { t } from '../../../../core/i18n/i18n';

/** The loan form's Closing costs & credits section: What is paid at closing besides the down payment, and the credits that pay it. */
@Component({
  selector: 'app-closing-section',
  imports: [ReactiveFormsModule, CurrencyPipe, NumberFieldComponent, TPipe],
  templateUrl: './closing-section.component.html',
  styleUrls: ['../loan-form.component.scss', './section.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosingSectionComponent {
  /** The form this section is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);

  /** The lines of a Loan Estimate's closing costs: sections A, B and C make the loan costs, E and H the other fees. */
  protected readonly itemRules = {
    origination: { get label() { return t('Origination charges (A)'); }, unit: '$', min: 0, max: MAX_AMOUNT },
    cannotShop: { get label() { return t('Services you cannot shop for (B)'); }, unit: '$', min: 0, max: MAX_AMOUNT },
    canShop: { get label() { return t('Services you can shop for (C)'); }, unit: '$', min: 0, max: MAX_AMOUNT },
    recording: { get label() { return t('Taxes and recording fees (E)'); }, unit: '$', min: 0, max: MAX_AMOUNT },
    other: { get label() { return t('Other (H)'); }, unit: '$', min: 0, max: MAX_AMOUNT },
  } as const satisfies FieldRules;

  /** True while the costs are entered line by line, and the two totals are what the lines add up to. */
  protected readonly itemizing = signal(false);

  protected readonly items = new FormGroup({
    origination: new FormControl<number | null>(0, validatorsFor(this.itemRules.origination)),
    cannotShop: new FormControl<number | null>(0, validatorsFor(this.itemRules.cannotShop)),
    canShop: new FormControl<number | null>(0, validatorsFor(this.itemRules.canShop)),
    recording: new FormControl<number | null>(0, validatorsFor(this.itemRules.recording)),
    other: new FormControl<number | null>(0, validatorsFor(this.itemRules.other)),
  });

  /** What the lines add up to, as the loan costs and the other fees. */
  protected readonly totals = signal({ loanCosts: 0, otherFees: 0 });

  constructor() {
    this.items.valueChanges.subscribe(() => this.carryTotals());
  }

  /** Starts itemizing from the two totals: the loan costs in the first line, the other fees in the recording line. */
  protected itemize(): void {
    const { loanCosts, otherFees } = this.f.form.getRawValue();
    this.items.reset({ origination: loanCosts ?? 0, cannotShop: 0, canShop: 0, recording: otherFees ?? 0, other: 0 }, { emitEvent: false });
    this.carryTotals(false);
    this.itemizing.set(true);
  }

  /** Back to the two totals, as the lines made them. */
  protected stopItemizing(): void {
    this.itemizing.set(false);
  }

  /** Puts the lines' sums into the form's two totals (to the cent), which is what the loan is figured on. */
  private carryTotals(write = true): void {
    const v = this.items.getRawValue();
    const cents = (n: number) => Math.round(n * 100) / 100;
    const loanCosts = cents((v.origination ?? 0) + (v.cannotShop ?? 0) + (v.canShop ?? 0));
    const otherFees = cents((v.recording ?? 0) + (v.other ?? 0));
    this.totals.set({ loanCosts, otherFees });
    if (write) this.f.form.patchValue({ loanCosts, otherFees });
  }
}
