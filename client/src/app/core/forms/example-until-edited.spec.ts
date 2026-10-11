import { DestroyRef } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { exampleUntilEdited } from './example-until-edited';

describe('exampleUntilEdited', () => {
  const destroyRef = (): DestroyRef & { destroy: () => void } => {
    const callbacks: (() => void)[] = [];
    return {
      onDestroy: (callback: () => void) => {
        callbacks.push(callback);
        return () => undefined;
      },
      destroyed: false,
      destroy: () => callbacks.forEach((callback) => callback()),
    } as unknown as DestroyRef & { destroy: () => void };
  };
  const form = () => new FormGroup({ price: new FormControl(375_000) });

  it('is an example until the first edit, and stays the visitor’s own after it', () => {
    const f = form();
    const example = exampleUntilEdited(f, true, destroyRef());

    expect(example()).toBe(true);
    f.controls.price.setValue(400_000);
    expect(example()).toBe(false);
    f.controls.price.setValue(375_000);
    expect(example()).toBe(false);
  });

  it('is never an example when the form started from a saved or shared loan', () => {
    expect(exampleUntilEdited(form(), false, destroyRef())()).toBe(false);
  });

  it('stops listening when the form goes away', () => {
    const f = form();
    const ref = destroyRef();
    const example = exampleUntilEdited(f, true, ref);

    ref.destroy();
    f.controls.price.setValue(400_000);

    expect(example()).toBe(true);
  });
});
