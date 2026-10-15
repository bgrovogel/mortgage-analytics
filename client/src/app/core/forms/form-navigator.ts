import { Injectable, signal } from '@angular/core';

/** A request to show one part of the form: a collapsible section, opened, and a field in it to focus. */
export interface FormDestination {
  /** The section's name, as its test id ends: 'income' for the section marked `section-income`. */
  section: string;
  /** The field to put the cursor in, by its test id, e.g. 'annual-income'. */
  field: string;
}

/**
 * Lets a result point at the input it needs ("Add your income") without knowing where the form is: it asks here, and
 * the form showing the calculator's own loan opens the section, brings it into view and focuses the field. Each
 * request is a new object, so asking for the same field twice still moves there.
 */
@Injectable({ providedIn: 'root' })
export class FormNavigator {
  private readonly destination = signal<FormDestination | null>(null);

  /** The latest request, for the form to act on. */
  readonly requested = this.destination.asReadonly();

  private readonly priceRequest = signal<{ price: number } | null>(null);

  /** The latest request to price the home at an amount ("Price a home at $474,091"), for the form to act on. */
  readonly pricing = this.priceRequest.asReadonly();

  /** Asks the form to open `section` and focus `field`. */
  open(section: string, field: string): void {
    this.destination.set({ section, field });
  }

  /** Asks the form to price the home at `price`, keeping the share put down. A new object each time, so it can be asked twice. */
  priceAt(price: number): void {
    this.priceRequest.set({ price });
  }
}
