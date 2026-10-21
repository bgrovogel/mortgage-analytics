import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';

let nextId = 0;

/**
 * A popup for what a page keeps one step away: a modal dialog (the browser's own, so focus stays inside it, Escape
 * closes it and the page behind is inert), named by its heading, closed by its button or a click on the backdrop,
 * with focus returned to what opened it. The host opens it: `<app-dialog #d heading="…">…</app-dialog>` and `d.open()`.
 */
@Component({
  imports: [TPipe],
  selector: 'app-dialog',
  template: `
    <dialog #dialog class="dialog" [attr.aria-labelledby]="titleId" (close)="onClosed()">
      <div class="surface">
        <header>
          <h2 [id]="titleId">{{ heading() }}</h2>
          <button type="button" class="close" (click)="close()">{{ 'Close' | t }}</button>
        </header>
        <div class="body"><ng-content /></div>
      </div>
    </dialog>
  `,
  styleUrl: './dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  /** What the dialog is about: its title, and its accessible name. */
  readonly heading = input.required<string>();

  /** Emits once the dialog has closed, however it was closed. */
  readonly closed = output<void>();

  protected readonly titleId = `dialog-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;
  /** What is being clicked, only while its click is handled: Safari does not focus a button when it is clicked, so focus is elsewhere. */
  private clicking: HTMLElement | null = null;

  constructor() {
    const remember = (event: Event) => {
      this.clicking = event.target instanceof Element ? event.target.closest<HTMLElement>('button, a[href], [tabindex]') : null;
      // The click's handlers run before this: a dialog opened from some other moment has no opener to remember but the focused one.
      setTimeout(() => (this.clicking = null));
    };
    document.addEventListener('click', remember, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('click', remember, true));

    // The backdrop is the dialog element around its content, so a click that lands on it (not in the content) closes.
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) this.close();
      });
    });
  }

  /** Shows the dialog over the page, remembering what had focus so it can be given back. */
  open(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    const focused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    this.opener = this.clicking ?? focused;
    // Where the browser has no modal dialog (old engines, test DOMs), it is shown in place.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  /** Closes the dialog. */
  close(): void {
    const dialog = this.dialog().nativeElement;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      this.onClosed();
    }
  }

  /** Whatever closed it (the button, Escape, the backdrop): focus goes back, and the host is told. */
  protected onClosed(): void {
    this.opener?.focus();
    this.opener = null;
    this.closed.emit();
  }
}
