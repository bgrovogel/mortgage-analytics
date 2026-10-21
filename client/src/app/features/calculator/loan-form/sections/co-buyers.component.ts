import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { LOAN_FORM } from '../loan-form.token';
import { TPipe } from '../../../../core/i18n/t.pipe';

/**
 * The others buying with the first buyer: each with an income and debts of their own and a share of the down payment.
 * Shown wherever the first buyer's income is asked for, once it is given: a lender counts everyone together.
 */
@Component({
  selector: 'app-co-buyers',
  imports: [ReactiveFormsModule, NumberFieldComponent, TPipe],
  templateUrl: './co-buyers.component.html',
  styleUrls: ['../loan-form.component.scss', './co-buyers.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoBuyersComponent {
  /** The form this is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);
}
