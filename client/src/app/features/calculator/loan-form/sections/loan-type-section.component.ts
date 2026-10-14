import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { FhaCountyComponent } from '../fha-county.component';
import { RateOptionsComponent } from '../../../../shared/rate-options/rate-options.component';
import { LOAN_FORM } from '../loan-form.token';

/** The loan form's Loan type & rate section: Conventional, FHA or VA, and the rate: fixed, a buydown, adjustable, or bought down with points. */
@Component({
  selector: 'app-loan-type-section',
  imports: [ReactiveFormsModule, NumberFieldComponent, FhaCountyComponent, RateOptionsComponent],
  templateUrl: './loan-type-section.component.html',
  styleUrls: ['../loan-form.component.scss', './section.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanTypeSectionComponent {
  /** The form this section is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);
}
