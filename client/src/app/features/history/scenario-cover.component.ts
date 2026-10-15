import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** What a saved item's cover is drawn from. */
export type CoverSource =
  | { kind: 'Purchase'; price: number; down: number }
  | { kind: 'Refinance'; currentRate: number; newRate: number }
  | { kind: 'Strategy' };

/**
 * The bars of a cover, each a share of the widest, from the item's own figures only: a purchase as what is put down
 * against what is borrowed, a refinance as the old rate against the new. A comparison has none, and gets a plain cover.
 */
export function coverShares(source: CoverSource): number[] {
  if (source.kind === 'Purchase') {
    if (source.price <= 0) return [];
    const down = Math.min(1, Math.max(0, source.down / source.price));
    return [1 - down, down];
  }
  if (source.kind === 'Refinance') {
    const widest = Math.max(source.currentRate, source.newRate);
    return widest > 0 ? [source.currentRate / widest, source.newRate / widest] : [];
  }
  return [];
}

/**
 * A small picture for a saved item (UI blueprint, pillar 5): its figures as bars, and the amount that leads its card
 * in serif. Drawn from the numbers alone, the same every time, with nothing personal in it.
 */
@Component({
  selector: 'app-scenario-cover',
  template: `
    <svg aria-hidden="true" viewBox="0 0 120 72" width="120" height="72" focusable="false">
      <rect x="0.5" y="0.5" width="119" height="71" rx="9.5" class="card" />
      @for (share of shares(); track $index) {
        <rect class="bar" [class.second]="$index === 1" x="10" [attr.y]="14 + $index * 8" [attr.width]="share * 100" height="5" rx="2.5" />
      }
      <text x="10" y="58" class="amount">{{ amount() }}</text>
    </svg>
  `,
  styles: `
    :host { display: block; line-height: 0; }
    .card { fill: var(--surface-2); stroke: var(--border); }
    .bar { fill: var(--accent); }
    .bar.second { fill: var(--text-muted); }
    .amount { font-family: var(--font-serif); font-size: 22px; fill: var(--text-primary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioCoverComponent {
  /** The bars, each between 0 and 1 of the widest. */
  readonly shares = input<number[]>([]);

  /** The text that leads the item's card ("$2,251.74 a month, ..."), of which the leading amount is drawn. */
  readonly figure = input<string | null>(null);

  /** The leading amount, to the dollar when it has digits, as given when it is masked. */
  protected readonly amount = computed(() => {
    const text = this.figure() ?? '';
    const money = /^\$[\d,.•]+/.exec(text)?.[0] ?? '';
    return /\d/.test(money) ? `$${Math.round(Number(money.replace(/[$,]/g, ''))).toLocaleString('en-US')}` : money;
  });
}
