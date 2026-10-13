import { FormControl, FormGroup } from '@angular/forms';
import { firstValueFrom, toArray } from 'rxjs';
import { FieldRule, problemWith, problemsIn, problemsOf, validatorsFor } from './field-rules';

describe('field rules', () => {
  const control = (rule: FieldRule, value: number | null) => new FormControl<number | null>(value, validatorsFor(rule));
  const problem = (rule: FieldRule, value: number | null) => problemWith(rule, control(rule, value));

  it('says nothing about a valid value', () => {
    expect(problem({ label: 'Tax rate', unit: '%', min: 0, max: 60 }, 24)).toBeNull();
  });

  it('writes each limit in the field\'s own unit', () => {
    expect(problem({ label: 'Tax rate', unit: '%', min: 0, max: 60 }, 61)).toBe('Tax rate must be between 0% and 60%.');
    expect(problem({ label: 'IRA', unit: '$', min: 0, max: 7_500 }, 8_000)).toBe('IRA must be between $0 and $7,500.');
    expect(problem({ label: 'Years left', unit: 'years', min: 1 / 12, max: 30 }, 31)).toBe('Years left must be between 1 month and 30 years.');
    expect(problem({ label: 'Term', unit: 'years', min: 1, max: 50 }, 0)).toBe('Term must be between 1 year and 50 years.');
    expect(problem({ label: 'Period', unit: 'months', min: 1, max: 27 }, 28)).toBe('Period must be between 1 month and 27 months.');
    expect(problem({ label: 'Payment', unit: 'number', min: 1, max: 600 }, 0)).toBe('Payment must be between 1 and 600.');
  });

  it('says "more than $0" for an amount that must merely be positive, and "at least" when there is no cap', () => {
    expect(problem({ label: 'Balance', unit: '$', min: 0.01, max: 100 }, 0)).toBe('Balance must be more than $0.');
    expect(problem({ label: 'Balance', unit: '$', min: 0.01, max: 100 }, 101)).toBe('Balance must be between $0 and $100.');
    expect(problem({ label: 'Price', unit: '$', min: 0.01 }, 0)).toBe('Price must be more than $0.');
    expect(problem({ label: 'Recast minimum', unit: '$', min: 1_000 }, 500)).toBe('Recast minimum must be at least $1,000.');
  });

  it('asks for a number when a required box is blank, but lets an optional one be blank', () => {
    expect(problem({ label: 'Income', unit: '$', min: 0 }, null)).toBe('Income: enter a number.');
    expect(problem({ label: 'HOA', unit: '$', min: 0, optional: true }, null)).toBeNull();
  });

  it('asks for whole numbers where only they make sense', () => {
    expect(problem({ label: 'Period', unit: 'months', min: 1, max: 27, whole: true }, 6.5)).toBe('Period: whole numbers only.');
  });

  it('lists every problem in the rules\' order, and reports the list only when it changes', async () => {
    const rules = { a: { label: 'A', unit: '%', min: 0, max: 10 }, b: { label: 'B', unit: '%', min: 0, max: 10 } } as const;
    const form = new FormGroup({ a: control(rules.a, 1), b: control(rules.b, 1) });
    const reports = firstValueFrom(problemsOf(form, () => problemsIn(rules, form.controls)).pipe(toArray()));

    form.controls.b.setValue(11);
    form.controls.a.setValue(11);
    form.controls.a.setValue(12); // still the same problems: not reported again
    form.controls.a.setValue(1);
    form.controls.b.setValue(1);
    form.controls.b.setValue(2);
    // valueChanges never completes on its own; finish the stream to read what it reported.
    (form.valueChanges as unknown as { complete(): void }).complete();

    expect(await reports).toEqual([[], ['B must be between 0% and 10%.'], ['A must be between 0% and 10%.', 'B must be between 0% and 10%.'], ['B must be between 0% and 10%.'], []]);
  });
});

describe('field messages at their edges', () => {
  const amount: FieldRule = { label: 'Credits', unit: '$', min: 0, max: 100 };

  it('give a $0 floor as a range, and a $1 floor as itself', () => {
    const control = new FormControl(-1, validatorsFor(amount));
    const dollar = new FormControl(0, validatorsFor({ ...amount, min: 1 }));

    expect(problemWith(amount, control)).toBe('Credits must be between $0 and $100.');
    expect(problemWith({ ...amount, min: 1 }, dollar)).toBe('Credits must be between $1 and $100.');
  });

  it('ask for a number when the box holds something that is not one', () => {
    const control = new FormControl(5, validatorsFor(amount));
    control.setErrors({ number: true });

    expect(problemWith(amount, control)).toBe('Credits: enter a number.');
  });

  it('say "1 month" for a twelfth of a year', () => {
    const term: FieldRule = { label: 'Term', unit: 'years', min: 1 / 12, max: 1 };

    expect(problemWith(term, new FormControl(0, validatorsFor(term)))).toBe('Term must be between 1 month and 1 year.');
  });
});
