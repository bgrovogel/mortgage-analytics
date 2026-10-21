import { ChangeDetectionStrategy, Component, DOCUMENT, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * Copies a link to this page with its inputs (core/state/share-link.ts), and says what anyone who opens it sees. When
 * the clipboard cannot be used (an older browser, or permission refused) it shows the link, selected, to copy by hand.
 */
@Component({
  imports: [TPipe],
  selector: 'app-share-link',
  template: `
    @if (copied()) {
      <p class="status" role="status" data-testid="share-status">{{ 'Link copied. Anyone with it sees these numbers.{0}' | t: [noteAfter()] }}</p>
    }
    @if (showButton()) {
      <button type="button" data-testid="share-copy" [disabled]="!fragment()" (click)="copy()">{{ 'Copy link' | t }}</button>
    }
    @if (manual(); as url) {
      <div class="manual" data-testid="share-manual">
        <label for="share-url">{{ 'Copy this link: anyone with it sees these numbers.{0}' | t: [noteAfter()] }}</label>
        <input #urlInput id="share-url" type="text" readonly data-testid="share-url" [value]="url" (focus)="urlInput.select()" />
        <button type="button" class="link" (click)="manual.set(null)">{{ 'Done' | t }}</button>
      </div>
    }
  `,
  styleUrl: './share-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLinkComponent {
  private readonly location = inject(DOCUMENT).location;

  /** The fragment that carries the inputs (`share=…`), or null while there are none. */
  readonly fragment = input<string | null>(null);

  /** What the link leaves out, or includes that someone might not expect. */
  readonly note = input<string | null>(null);

  /** False when something else holds the Copy link button (a menu) and this says what copying did. */
  readonly showButton = input(true);

  /** The fragment last copied: the status holds only while the inputs are still the ones copied. */
  private readonly copiedFragment = signal<string | null>(null);

  protected readonly copied = computed(() => this.copiedFragment() !== null && this.copiedFragment() === this.fragment());

  /** The link to copy by hand, when the clipboard could not take it. */
  protected readonly manual = signal<string | null>(null);

  protected readonly noteAfter = computed(() => (this.note() ? ` ${this.note()}` : ''));

  private readonly urlInput = viewChild<ElementRef<HTMLInputElement>>('urlInput');

  constructor() {
    // Select the link as soon as it is shown, ready to copy.
    effect(() => this.urlInput()?.nativeElement.select());
  }

  async copy(): Promise<void> {
    const fragment = this.fragment();
    if (!fragment) return;
    const url = `${this.location.origin}${this.location.pathname}#${fragment}`;
    try {
      await navigator.clipboard.writeText(url);
      this.manual.set(null);
      this.copiedFragment.set(fragment);
    } catch {
      this.copiedFragment.set(null);
      this.manual.set(url);
    }
  }
}
