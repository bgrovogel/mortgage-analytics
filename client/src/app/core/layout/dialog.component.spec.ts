import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogComponent } from './dialog.component';

@Component({
  imports: [DialogComponent],
  template: `
    <button type="button" data-testid="opener" (click)="dialog().open()">Open</button>
    <app-dialog heading="Comparing offers" (closed)="closedCount = closedCount + 1">
      <p data-testid="inside">What is in it</p>
    </app-dialog>
  `,
})
class HostComponent {
  readonly dialog = viewChild.required(DialogComponent);
  closedCount = 0;
}

describe('DialogComponent', () => {
  const render = () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement); // focus only lands on what is in the document
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, dialog: root.querySelector('dialog') as HTMLDialogElement, opener: root.querySelector('[data-testid="opener"]') as HTMLButtonElement };
  };
  afterEach(() => document.body.replaceChildren());

  it('is shut until it is opened, then shows what it holds under its heading', () => {
    const { fixture, dialog, opener } = render();
    expect(dialog.open).toBe(false);

    opener.focus();
    fixture.componentInstance.dialog().open();

    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')!.textContent!.trim()).toBe('Comparing offers');
    expect(dialog.getAttribute('aria-labelledby')).toBe(dialog.querySelector('h2')!.id);
    expect(dialog.querySelector('[data-testid="inside"]')).not.toBeNull();
  });

  it('closes with its close button, and lets the host know', () => {
    const { fixture, dialog } = render();
    fixture.componentInstance.dialog().open();

    (dialog.querySelector('button.close') as HTMLButtonElement).click();

    expect(dialog.open).toBe(false);
    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('closes when the backdrop is clicked, but not when its content is', () => {
    const { fixture, dialog } = render();
    fixture.componentInstance.dialog().open();

    (dialog.querySelector('[data-testid="inside"]') as HTMLElement).click();
    expect(dialog.open).toBe(true);

    dialog.click(); // a click on the dialog itself is a click on the backdrop around its content
    expect(dialog.open).toBe(false);
  });

  it('puts focus back on what opened it', () => {
    const { fixture, dialog, opener } = render();
    opener.focus();
    fixture.componentInstance.dialog().open();
    (dialog.querySelector('button.close') as HTMLButtonElement).focus();

    fixture.componentInstance.dialog().close();

    expect(document.activeElement).toBe(opener);
  });
});
