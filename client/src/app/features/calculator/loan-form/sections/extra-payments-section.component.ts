import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { LOAN_FORM } from '../loan-form.token';
import { TPipe } from '../../../../core/i18n/t.pipe';

/** The loan form's Extra payments section: Extra principal once a year or as lump sums, and whether it pays the loan off sooner or lowers the payment. */
@Component({
  selector: 'app-extra-payments-section',
  imports: [ReactiveFormsModule, NumberFieldComponent, TPipe],
  templateUrl: './extra-payments-section.component.html',
  styleUrls: ['../loan-form.component.scss', './section.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtraPaymentsSectionComponent {
  /** The form this section is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);
}
