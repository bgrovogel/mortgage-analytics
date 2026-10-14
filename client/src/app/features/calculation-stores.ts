import { Injectable, inject } from '@angular/core';
import { SavedCalculation, SavedCalculationKind } from '../core/models/saved-calculation.models';
import { CalculationStore, SavedLink } from '../core/state/calculation-store';
import { CalculatorStore } from './calculator/calculator.store';
import { ComparisonStore } from './calculator/comparison.store';
import { RefinanceStore } from './refinance/refinance.store';
import { StrategyStore } from './strategy/strategy.store';

/**
 * Every calculator page's store, so History and sign-out can treat saved calculations the same way whatever
 * their kind: open one on its page, describe it, and keep the pages' links to saved items up to date.
 */
@Injectable({ providedIn: 'root' })
export class CalculationStores {
  private readonly all: readonly CalculationStore<unknown, unknown>[] = [
    inject(CalculatorStore),
    inject(ComparisonStore),
    inject(RefinanceStore),
    inject(StrategyStore),
  ];

  /** Each kind of saved calculation and the page it opens on, in the navigation's order. */
  pages(): { kind: SavedCalculationKind; pageName: string }[] {
    return this.all.map(({ kind, pageName }) => ({ kind, pageName }));
  }

  /** The store for one kind of saved calculation. */
  of(kind: SavedCalculationKind): CalculationStore<unknown, unknown> {
    return this.all.find((store) => store.kind === kind)!;
  }

  /** One line that tells a saved calculation apart from others. */
  describe(calculation: SavedCalculation): string {
    const store = this.of(calculation.kind);
    return store.describe(store.inputsOf(calculation));
  }

  /** Keeps the page showing a renamed calculation linked to its new name. */
  renamed(calculation: SavedLink): void {
    for (const store of this.all) if (store.saved()?.id === calculation.id) store.linkTo(calculation);
  }

  /** Unlinks the page showing a deleted calculation, so Save makes a new one. */
  deleted(id: string): void {
    for (const store of this.all) if (store.saved()?.id === id) store.saved.set(null);
  }

  /** Unlinks every page (on sign-out: the saved items belonged to the account). */
  unlinkAll(): void {
    for (const store of this.all) store.saved.set(null);
  }
}
