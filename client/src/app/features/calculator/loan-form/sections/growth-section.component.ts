import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ControlContainer, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { NumberFieldComponent } from '../../../../core/forms/number-field.component';
import { LOAN_FORM } from '../loan-form.token';
import { TPipe } from '../../../../core/i18n/t.pipe';

/** The loan form's Future increases section: How fast the home value, insurance and HOA dues rise each year. */
@Component({
  selector: 'app-growth-section',
  imports: [ReactiveFormsModule, NumberFieldComponent, TPipe],
  templateUrl: './growth-section.component.html',
  styleUrls: ['../loan-form.component.scss', './section.component.scss'],
  // Its controls belong to the loan form's own form group.
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrowthSectionComponent {
  /** The form this section is part of, with its values and what it works out from them. */
  protected readonly f = inject(LOAN_FORM);
}
