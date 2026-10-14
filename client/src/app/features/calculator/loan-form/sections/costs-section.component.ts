import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { LOAN_FORM } from '../loan-form.token';

/** The loan form's Taxes, insurance, HOA & PMI section: Everything paid with the loan each month besides principal and interest: property taxes and any PID, insurance, HOA dues and PMI. */
@Component({
  selector: 'app-costs-section',
  imports: [ReactiveFormsModule, CurrencyPipe, NumberFieldComponent],
  templateUrl: './costs-section.component.html',
  styleUrls: ['../loan-form.component.scss', './section.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostsSectionComponent {
  /** The form this section is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);
}
