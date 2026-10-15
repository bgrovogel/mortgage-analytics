import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, map, startWith, switchMap } from 'rxjs';
import { toErrorMessages } from '../../core/errors/problem-details';
import { purchaseFigure, refinanceFigure } from '../../core/formatting/describe-inputs';
import { decimal, usd, usdCents } from '../../core/formatting/format';
import { maskAmounts } from '../../core/formatting/mask-amounts';
import { monthlyPayment } from '../../core/loans/loan-progress';
import { SavedCalculation, SavedCalculationKind, savedInputsOf } from '../../core/models/saved-calculation.models';
import { SavedCalculationsApiService } from '../../core/services/saved-calculations-api.service';
import { CalculationStores } from '../calculation-stores';
import { ScenarioCoverComponent, coverShares } from './scenario-cover.component';

/** How long to wait after the last keystroke before searching. */
export const SEARCH_DELAY_MS = 300;

/** How long an amount stays shown once it is revealed in privacy mode. */
export const REVEAL_MS = 30_000;

/** Where privacy mode is remembered, per browser. */
export const HIDE_AMOUNTS_KEY = 'hide-amounts';

const loadHidden = (): boolean => {
  try {
    return localStorage.getItem(HIDE_AMOUNTS_KEY) === '1';
  } catch {
    return false;
  }
};

const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Every saved calculation (purchases, refinance and pay-off-or-invest comparisons), newest first, searchable by
 * name and filterable by kind. Each opens on its own page, can be renamed in place, or deleted after a
 * confirmation.
 */
@Component({
  selector: 'app-history-page',
  imports: [RouterLink, ScenarioCoverComponent],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPageComponent {
  private readonly api = inject(SavedCalculationsApiService);
  private readonly stores = inject(CalculationStores);
  private readonly router = inject(Router);
  private readonly searches = new Subject<string>();

  /** The calculations shown: the current search's results. */
  readonly calculations = signal<SavedCalculation[]>([]);

  /** False until the first list arrives (or fails), so the empty message does not flash. */
  readonly loaded = signal(false);

  /** The search the list currently reflects. */
  readonly searched = signal('');

  /** What went wrong with the last action, if anything. */
  readonly error = signal<string | null>(null);

  /** The calculation being renamed, and the name typed so far. */
  readonly renaming = signal<{ id: string; name: string } | null>(null);

  /** The calculation waiting for a delete confirmation. */
  readonly confirmingDelete = signal<string | null>(null);

  /** Which kinds are shown. */
  readonly kindFilter = signal<SavedCalculationKind | 'all'>('all');

  /** The calculations shown: the search results, filtered by kind. */
  readonly shown = computed(() => {
    const kind = this.kindFilter();
    return kind === 'all' ? this.calculations() : this.calculations().filter((c) => c.kind === kind);
  });

  /** What is shown, in a group for each page it opens on (the order the pages are in); one untitled group for a chosen kind. */
  readonly groups = computed(() => {
    const shown = this.shown();
    if (this.kindFilter() !== 'all') return [{ kind: null, title: null, items: shown }];
    return this.stores.pages()
      .map(({ kind, pageName }) => ({ kind, title: pageName, items: shown.filter((c) => c.kind === kind) }))
      .filter((group) => group.items.length > 0);
  });

  /** The filter's choices: all, then each kind by the name of the page it opens on. */
  protected readonly kinds: { value: SavedCalculationKind | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    ...this.stores.pages().map(({ kind, pageName }) => ({ value: kind, label: pageName })),
  ];

  /** A kind's name, as the navigation shows its page: "Calculator", "Refinance", "Pay off or invest". */
  protected kindLabel(kind: SavedCalculationKind): string {
    return this.stores.of(kind).pageName;
  }

  constructor() {
    this.listenForPrivacy();
    // The first list loads at once; later searches wait for a pause in typing. switchMap drops the
    // results of a search that a newer one has replaced, and errors are caught per search.
    this.searches
      .pipe(
        debounceTime(SEARCH_DELAY_MS),
        startWith(''),
        switchMap((term) =>
          this.api.list(term).pipe(
            map((list) => ({ term: term.trim(), list })),
            catchError((error: unknown) => {
              this.fail(error);
              this.loaded.set(true);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ term, list }) => {
        this.calculations.set(list);
        this.searched.set(term);
        this.error.set(null);
        this.loaded.set(true);
      });
  }

  /** Privacy mode: dollar amounts are masked (their digits hidden, their shape kept) until revealed one by one. */
  readonly amountsHidden = signal(loadHidden());

  /** The saved items whose amounts are shown for now; they are masked again after 30 seconds, and when the tab loses focus. */
  private readonly revealed = signal<ReadonlySet<string>>(new Set());
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Privacy mode's two listeners: the tab losing focus masks everything again, and Shift+H switches the mode. */
  private listenForPrivacy(): void {
    const mask = () => this.maskAll();
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.shiftKey && event.key.toLowerCase() === 'h' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.setAmountsHidden(!this.amountsHidden());
      }
    };
    window.addEventListener('blur', mask);
    document.addEventListener('keydown', key);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('blur', mask);
      document.removeEventListener('keydown', key);
      this.timers.forEach((timer) => clearTimeout(timer));
    });
  }

  /** Turns privacy mode on or off, and remembers it. Turning it on masks everything again. */
  setAmountsHidden(hidden: boolean): void {
    this.amountsHidden.set(hidden);
    this.maskAll();
    try {
      localStorage.setItem(HIDE_AMOUNTS_KEY, hidden ? '1' : '0');
    } catch {
      // Not remembered this time; the page still works.
    }
  }

  /** True while an item's amounts are masked. */
  isMasked(calculation: SavedCalculation): boolean {
    return this.amountsHidden() && !this.revealed().has(calculation.id);
  }

  /** A text of an item's, with its amounts masked when privacy mode hides them. */
  masked(calculation: SavedCalculation, text: string): string {
    return this.isMasked(calculation) ? maskAmounts(text) : text;
  }

  /** Shows an item's amounts for 30 seconds, or hides them again. */
  toggleReveal(calculation: SavedCalculation): void {
    const id = calculation.id;
    if (this.revealed().has(id)) {
      this.mask(id);
      return;
    }
    this.revealed.update((ids) => new Set(ids).add(id));
    this.timers.set(id, setTimeout(() => this.mask(id), REVEAL_MS));
  }

  private mask(id: string): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.revealed.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  private maskAll(): void {
    [...this.revealed()].forEach((id) => this.mask(id));
  }

  /** Queues a search for names containing `text`. */
  onSearch(text: string): void {
    this.searches.next(text);
  }

  /** One line that tells saved items apart, in the terms of their kind. */
  describe(calculation: SavedCalculation): string {
    return this.stores.describe(calculation);
  }

  /** The ids of the saved purchases picked to set side by side: at most two. */
  readonly picked = signal<string[]>([]);

  /** Picks a purchase, or puts it back. */
  togglePick(id: string): void {
    this.picked.update((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : ids.length < 2 ? [...ids, id] : ids));
  }

  /** The two picked purchases' numbers in rows, each with the second's difference from the first; null until there are two. */
  readonly pair = computed(() => {
    const [first, second] = this.picked().map((id) => this.calculations().find((c) => c.id === id));
    const a = first?.inputs;
    const b = second?.inputs;
    if (!first || !second || !a || !b) return null;
    const money = (n: number) => `${n < 0 ? '−' : '+'}${usd(Math.abs(n))}`;
    const payment = (r: typeof a) => monthlyPayment(r.homePrice - r.downPayment, r.annualInterestRate, r.termInMonths);
    const points = (n: number) => `${n < 0 ? '−' : '+'}${decimal(Math.abs(n), 3)} pt`;
    const rows = [
      { label: 'Home price', a: usd(a.homePrice), b: usd(b.homePrice), difference: a.homePrice === b.homePrice ? '' : money(b.homePrice - a.homePrice) },
      { label: 'Down payment', a: usd(a.downPayment), b: usd(b.downPayment), difference: a.downPayment === b.downPayment ? '' : money(b.downPayment - a.downPayment) },
      {
        label: 'Rate', a: `${decimal(a.annualInterestRate)}%`, b: `${decimal(b.annualInterestRate)}%`,
        difference: a.annualInterestRate === b.annualInterestRate ? '' : points(b.annualInterestRate - a.annualInterestRate),
      },
      {
        label: 'Term', a: `${a.termInMonths / 12} yr`, b: `${b.termInMonths / 12} yr`,
        difference: a.termInMonths === b.termInMonths ? '' : `${b.termInMonths < a.termInMonths ? '−' : '+'}${Math.abs(b.termInMonths - a.termInMonths) / 12} yr`,
      },
      {
        label: 'Principal and interest', a: usdCents(payment(a)), b: usdCents(payment(b)),
        difference: payment(a) === payment(b) ? '' : `${payment(b) < payment(a) ? '−' : '+'}${usdCents(Math.abs(payment(b) - payment(a)))}`,
      },
    ];
    return { names: [first.name, second.name], rows };
  });

  /** The payment a saved purchase or refinance comes to, to lead its card, or null when its numbers do not say. */
  figure(calculation: SavedCalculation): string | null {
    if (calculation.kind === 'Purchase' && calculation.inputs) return purchaseFigure(calculation.inputs);
    if (calculation.kind === 'Refinance' && calculation.refinance) return refinanceFigure(calculation.refinance);
    return null;
  }

  /** The bars of an item's cover, from its own figures: what is put down against borrowed, or the old rate against the new. */
  coverOf(calculation: SavedCalculation): number[] {
    const { inputs, refinance } = calculation;
    if (calculation.kind === 'Purchase' && inputs) return coverShares({ kind: 'Purchase', price: inputs.homePrice, down: inputs.downPayment });
    if (calculation.kind === 'Refinance' && refinance) {
      return coverShares({ kind: 'Refinance', currentRate: refinance.currentAnnualInterestRate, newRate: refinance.newAnnualInterestRate });
    }
    return [];
  }

  /** "Saved Oct 9, 2026", or "Updated …" once it has been changed. */
  when(calculation: SavedCalculation): string {
    return calculation.updatedAt === calculation.createdAt
      ? `Saved ${day.format(new Date(calculation.createdAt))}`
      : `Updated ${day.format(new Date(calculation.updatedAt))}`;
  }

  /** Loads the calculation on its own page (the calculator, refinance or pay-off-or-invest) and goes there. */
  open(calculation: SavedCalculation): void {
    const store = this.stores.of(calculation.kind);
    store.open(calculation);
    void this.router.navigate([...store.route]);
  }

  /** Starts renaming, with the current name to edit. */
  startRename(calculation: SavedCalculation): void {
    this.confirmingDelete.set(null);
    this.renaming.set({ id: calculation.id, name: calculation.name });
  }

  /** Asks to confirm deleting a calculation. */
  askToDelete(calculation: SavedCalculation): void {
    this.renaming.set(null);
    this.confirmingDelete.set(calculation.id);
  }

  /** Saves the new name; the inputs are sent back unchanged. */
  saveRename(calculation: SavedCalculation): void {
    const name = this.renaming()?.name.trim();
    if (!name) {
      this.error.set('Give the calculation a name.');
      return;
    }

    this.api.update(calculation.id, name, savedInputsOf(calculation)).subscribe({
      next: (updated) => {
        this.calculations.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        // Keep whichever page shows this calculation linked to its new name.
        this.stores.renamed(updated);
        this.renaming.set(null);
        this.error.set(null);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Deletes a calculation once the user has confirmed. */
  remove(calculation: SavedCalculation): void {
    this.api.delete(calculation.id).subscribe({
      next: () => {
        this.calculations.update((list) => list.filter((c) => c.id !== calculation.id));
        this.stores.deleted(calculation.id);
        this.confirmingDelete.set(null);
        this.error.set(null);
      },
      error: (error: unknown) => {
        this.confirmingDelete.set(null);
        this.fail(error);
      },
    });
  }

  private fail(error: unknown): void {
    this.error.set(toErrorMessages(error).join(' '));
  }
}
