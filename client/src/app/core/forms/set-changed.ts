import { FormGroup } from '@angular/forms';

/**
 * Sets the given controls of a form without emitting changes, and says whether any value actually changed:
 * e.g. to start a form from the shared loan, and mention it only when it made a difference.
 */
export function setChanged(form: FormGroup, values: Record<string, number | string>): boolean {
  let changed = false;
  for (const [name, value] of Object.entries(values)) {
    const control = form.get(name)!;
    if (control.value === value) continue;
    control.setValue(value, { emitEvent: false });
    changed = true;
  }
  return changed;
}
