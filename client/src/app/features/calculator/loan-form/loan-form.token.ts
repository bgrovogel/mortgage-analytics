import { InjectionToken } from '@angular/core';
import type { LoanFormComponent } from './loan-form.component';

/**
 * The loan form, for the sections it is made of: each section shows its own fields, and reads the form's values, and
 * what the form works out from them, from here. One form holds them all, so the request is built in one place.
 */
export const LOAN_FORM = new InjectionToken<LoanFormComponent>('LoanForm');
