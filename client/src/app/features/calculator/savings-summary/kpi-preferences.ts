import { Injectable, computed, signal } from '@angular/core';

/** The figures of the rail under the headline, by what they are. */
export const KPI_KEYS = ['cash', 'payoff', 'afford', 'savings', 'pmi'] as const;
export type KpiKey = (typeof KPI_KEYS)[number];

/** What each figure is called when the rail is arranged. */
export const KPI_LABELS: Record<KpiKey, string> = {
  cash: 'Cash to close',
  payoff: 'Paid off',
  afford: 'Can you afford it?',
  savings: 'Savings from paying extra, or the interest',
  pmi: 'When the mortgage insurance ends',
};

/** Where the arrangement is remembered, per browser. */
export const KPI_STORAGE_KEY = 'kpi-rail';

export interface Saved {
  order: KpiKey[];
  hidden: KpiKey[];
}

/** An arrangement kept to the figures that exist: an unknown name is dropped, and a new figure joins at the end. */
function known(raw: { order?: unknown; hidden?: unknown } | null): Saved {
  const names = (list: unknown): KpiKey[] => (Array.isArray(list) ? list.filter((k): k is KpiKey => KPI_KEYS.includes(k as KpiKey)) : []);
  return { order: [...new Set([...names(raw?.order), ...KPI_KEYS])], hidden: names(raw?.hidden) };
}

/** What this browser remembered. */
function load(): Saved {
  try {
    return known(JSON.parse(localStorage.getItem(KPI_STORAGE_KEY) ?? 'null') as Partial<Saved> | null);
  } catch {
    return known(null);
  }
}

/**
 * Which key figures the rail shows, and in what order: the reader's, not the page's (UI blueprint, pillar 5). It is
 * remembered in this browser. The figures themselves, and when each applies, stay the page's: this only arranges them.
 */
@Injectable({ providedIn: 'root' })
export class KpiPreferences {
  private readonly saved = load();

  /** Every figure in the reader's order, shown or not. */
  readonly order = signal<KpiKey[]>(this.saved.order);

  /** The figures the reader has put away. */
  readonly hidden = signal<ReadonlySet<KpiKey>>(new Set(this.saved.hidden));

  /** The figures to show, in order. */
  readonly visible = computed(() => this.order().filter((key) => !this.hidden().has(key)));

  /** Moves a figure one place earlier (-1) or later (1). */
  move(key: KpiKey, by: -1 | 1): void {
    const order = [...this.order()];
    const at = order.indexOf(key);
    const to = at + by;
    if (to < 0 || to >= order.length) return;
    [order[at], order[to]] = [order[to], order[at]];
    this.order.set(order);
    this.save();
  }

  /** Shows a figure, or puts it away. */
  toggle(key: KpiKey): void {
    const hidden = new Set(this.hidden());
    if (!hidden.delete(key)) hidden.add(key);
    this.hidden.set(hidden);
    this.save();
  }

  /** The arrangement as lists of names, the way the account keeps it. */
  arrangement(): Saved {
    return { order: this.order(), hidden: [...this.hidden()] };
  }

  /** True while it is the page's own arrangement: every figure shown, in the page's order. */
  isDefault(): boolean {
    return this.hidden().size === 0 && this.order().every((key, i) => key === KPI_KEYS[i]);
  }

  /** Takes an arrangement from elsewhere (the account), kept to the figures that exist, and remembers it here too. */
  apply(raw: { order: string[]; hidden: string[] }): void {
    const arranged = known(raw);
    this.order.set(arranged.order);
    this.hidden.set(new Set(arranged.hidden));
    this.save();
  }

  /** Back to the page's own arrangement. */
  reset(): void {
    this.order.set([...KPI_KEYS]);
    this.hidden.set(new Set());
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify({ order: this.order(), hidden: [...this.hidden()] }));
    } catch {
      // Not remembered this time; the rail still works.
    }
  }
}
