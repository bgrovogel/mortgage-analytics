import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { LOAN_FORM } from '../loan-form.token';
import { STATE_PROPERTY_TAX_RATES, stateRate, stateRules } from '../state-property-tax';
import { TPipe } from '../../../../core/i18n/t.pipe';

/** The loan form's Taxes, insurance, HOA & PMI section: Everything paid with the loan each month besides principal and interest: property taxes and any PID, insurance, HOA dues and PMI. */
@Component({
  selector: 'app-costs-section',
  imports: [ReactiveFormsModule, CurrencyPipe, NumberFieldComponent, TPipe],
  templateUrl: './costs-section.component.html',
  styleUrls: ['../loan-form.component.scss', './section.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostsSectionComponent {
  /** The form this section is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);

  protected readonly states = STATE_PROPERTY_TAX_RATES;

  /** What is known of how a new buyer in the state last chosen is taxed; empty where it has not been checked. */
  protected readonly rulesNote = signal('');

  /**
   * Starts the property tax rate from a state's typical one, and, where the state's rules for a new buyer are known, the
   * appraisal cap and homestead exemption too. Then goes back to asking so the same state can be chosen again.
   */
  protected useState(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const { propertyTaxRate, homesteadAssessmentCap, propertyTaxHomesteadExemption } = this.f.form.controls;
    const rate = stateRate(select.value);
    if (rate !== undefined) propertyTaxRate.setValue(rate);
    const rules = stateRules(select.value);
    if (rules) {
      homesteadAssessmentCap.setValue(rules.assessmentCap);
      propertyTaxHomesteadExemption.setValue(rules.homesteadExemption ?? 0);
    }
    this.rulesNote.set(rules?.note ?? '');
    select.value = '';
  }
}
