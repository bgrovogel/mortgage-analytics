import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { LOAN_FORM } from '../loan-form.token';

/** The loan form's Closing costs & credits section: What is paid at closing besides the down payment, and the credits that pay it. */
@Component({
  selector: 'app-closing-section',
  imports: [ReactiveFormsModule, NumberFieldComponent],
  templateUrl: './closing-section.component.html',
  styleUrls: ['../loan-form.component.scss', './section.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosingSectionComponent {
  /** The form this section is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);
}
