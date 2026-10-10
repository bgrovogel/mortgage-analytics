import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Observable, distinctUntilChanged, map, startWith } from 'rxjs';
import { decimal, usd } from '../formatting/format';

/** The largest dollar amount the API accepts in most fields (and the largest loan). */
export const MAX_AMOUNT = 100_000_000;

/**
 * What one number on a form means and what it may hold. Each form keeps a table of these that mirrors the
 * API's validator, so the form flags a bad value at once, in the same words, instead of the request failing.
 */
export interface FieldRule {
  /** The field's name in messages, e.g. "Interest rate". */
  label: string;
  /** What the number counts: it decides the box's "$" or "%" and how limits are written. */
  unit: '$' | '%' | 'years' | 'months' | 'number';
  min: number;
  /** The most the API accepts; none when only the loan itself limits it. */
  max?: number;
  /** True when only whole numbers make sense (counts, payment numbers). */
  whole?: boolean;
  /** True when the box may be left blank (it then counts as nothing). */
  optional?: boolean;
  /** The most decimal places shown: 2 unless the field needs more (tax rates) or fewer (counts). */
  decimals?: number;
}

/** A form's rules, one per number field. */
export type FieldRules = Record<string, FieldRule>;

const wholeNumber: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value === null || Number.isInteger(control.value) ? null : { whole: true };

/** The validators for a rule: required (unless optional), within its limits, whole when it must be. */
export function validatorsFor(rule: FieldRule): ValidatorFn[] {
  return [
    ...(rule.optional ? [] : [Validators.required]),
    Validators.min(rule.min),
    ...(rule.max === undefined ? [] : [Validators.max(rule.max)]),
    ...(rule.whole ? [wholeNumber] : []),
  ];
}

/** One limit in the rule's unit: "$7,500", "60%", "30 years", "27 months", "50". */
function limit(rule: FieldRule, value: number): string {
  switch (rule.unit) {
    case '$':
      return usd(value);
    case '%':
      return `${decimal(value, 4)}%`;
    case 'years':
      return value < 1 ? `${Math.round(value * 12)} month${Math.round(value * 12) === 1 ? '' : 's'}` : `${decimal(value)} year${value === 1 ? '' : 's'}`;
    case 'months':
      return `${decimal(value)} month${value === 1 ? '' : 's'}`;
    case 'number':
      return decimal(value);
  }
}

/** True for an amount that must merely be positive: its floor is a cent, which "more than $0" says plainly. */
const mustBePositive = (rule: FieldRule) => rule.unit === '$' && rule.min > 0 && rule.min < 1;

/** "between $0 and $7,500", or "at least $1,000" when only the floor is set. */
function range(rule: FieldRule): string {
  const floor = mustBePositive(rule) ? 0 : rule.min;
  return rule.max === undefined ? `at least ${limit(rule, floor)}` : `between ${limit(rule, floor)} and ${limit(rule, rule.max)}`;
}

/** What is wrong with a field, in plain words, or null when nothing is. */
export function problemWith(rule: FieldRule, control: AbstractControl): string | null {
  if (control.valid || control.disabled) return null;
  if (control.hasError('required') || control.hasError('number')) return `${rule.label}: enter a number.`;
  if (control.hasError('whole')) return `${rule.label}: whole numbers only.`;
  if (control.hasError('min') && mustBePositive(rule)) return `${rule.label} must be more than $0.`;
  return `${rule.label} must be ${range(rule)}.`;
}

/** Everything wrong with a form's number fields, one line per field, in the rules' order. */
export function problemsIn(rules: FieldRules, controls: Record<string, AbstractControl>): string[] {
  return Object.entries(rules)
    .map(([field, rule]) => (controls[field] ? problemWith(rule, controls[field]) : null))
    .filter((problem): problem is string => problem !== null);
}

/**
 * The form's problems as they change, starting with the current ones; repeats are left out. While the list is
 * not empty no request is sent, so a page can say its results are for the last valid inputs.
 */
export function problemsOf(form: AbstractControl, list: () => string[]): Observable<string[]> {
  return form.valueChanges.pipe(
    startWith(null),
    map(() => list()),
    distinctUntilChanged((a, b) => a.join('\n') === b.join('\n')),
  );
}
