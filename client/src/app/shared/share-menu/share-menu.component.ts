import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, input, output, signal, viewChild, viewChildren } from '@angular/core';
import { ShareLinkComponent } from '../share-link/share-link.component';

/**
 * One Share button holding what leaves the page: a link to these numbers, and a printout (or PDF). Out of sight
 * until opened, so the row above the results has one button where there were two. It follows the menu button
 * pattern: focus moves to the first choice, the arrow keys move between them, Escape closes and returns focus to the
 * button, and so does a click anywhere else.
 */
@Component({
  selector: 'app-share-menu',
  imports: [ShareLinkComponent],
  host: { '(document:click)': 'closeOnOutsideClick($event)' },
  template: `
    <!-- Says what copying did, and offers the link to copy by hand when the clipboard cannot be used. -->
    <app-share-link #link [fragment]="fragment()" [note]="note()" [showButton]="false" />
    <div class="share">
      <button #trigger type="button" class="trigger" data-testid="share-menu" aria-haspopup="menu"
              [attr.aria-expanded]="open()" (click)="toggle()">Share <span aria-hidden="true">▾</span></button>
      @if (open()) {
        <div class="menu">
          <div class="items" role="menu" aria-label="Share" aria-describedby="share-scope" tabindex="-1" (keydown)="onKeydown($event)">
            <button #item type="button" role="menuitem" data-testid="share-copy" [disabled]="!fragment()" (click)="copyLink()">Copy link</button>
            <button #item type="button" role="menuitem" data-testid="print" [disabled]="!canPrint()" (click)="printPage()">Print or save as PDF</button>
          </div>
          <!-- Said before anything is copied: what a link carries, and what it never does. -->
          <p class="scope" id="share-scope" data-testid="share-scope">A link holds these numbers only, never your name, email or saved list.</p>
        </div>
      }
    </div>
  `,
  styleUrl: './share-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly link = viewChild.required(ShareLinkComponent);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  /** The fragment that carries the inputs (`share=…`), or null while there are none. */
  readonly fragment = input<string | null>(null);

  /** What the link leaves out, or includes that someone might not expect. */
  readonly note = input<string | null>(null);

  /** Whether there is a result to print. */
  readonly canPrint = input(true);

  /** The visitor asked to print. */
  readonly print = output<void>();

  protected readonly open = signal(false);

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.open.set(true);
    // The menu is drawn after this change: the first choice that can be used takes focus then.
    afterNextRender(() => this.enabled()[0]?.focus(), { injector: this.injector });
  }

  protected async copyLink(): Promise<void> {
    this.open.set(false);
    await this.link().copy();
  }

  protected printPage(): void {
    this.open.set(false);
    this.print.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.enabled();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      this.open.set(false);
      this.trigger().nativeElement.focus();
    } else if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault();
      items[(at + 1) % items.length].focus();
    } else if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length].focus();
    } else if (event.key === 'Tab') {
      this.open.set(false);
    }
  }

  protected closeOnOutsideClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  private enabled(): HTMLButtonElement[] {
    return this.items().map((item) => item.nativeElement).filter((button) => !button.disabled);
  }
}
