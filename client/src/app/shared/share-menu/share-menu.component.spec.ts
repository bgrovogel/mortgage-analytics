import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShareMenuComponent } from './share-menu.component';

@Component({
  imports: [ShareMenuComponent],
  template: `<app-share-menu [fragment]="fragment()" [note]="note" [canPrint]="canPrint()" (print)="printed = printed + 1" (printShort)="printedShort = printedShort + 1" />
             <button type="button" data-testid="elsewhere">elsewhere</button>`,
})
class HostComponent {
  readonly fragment = signal<string | null>('share=abc');
  readonly canPrint = signal(true);
  note: string | null = 'Your income and debts are left out.';
  printed = 0;
  printedShort = 0;
}

describe('ShareMenuComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let writeText: jest.Mock;

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement>(id: string) => root().querySelector<T>(`[data-testid="${id}"]`);
  const open = () => {
    find('share-menu')!.click();
    fixture.detectChanges();
  };

  it('is one button, with what it holds out of sight until it is opened', () => {
    expect(find('share-menu')!.getAttribute('aria-haspopup')).toBe('menu');
    expect(find('share-menu')!.getAttribute('aria-expanded')).toBe('false');
    expect(root().querySelector('[role="menu"]')).toBeNull();

    open();

    expect(find('share-menu')!.getAttribute('aria-expanded')).toBe('true');
    expect([...root().querySelectorAll('[role="menuitem"]')].map((i) => i.textContent!.trim())).toEqual(['Copy link', 'Print or save as PDF', 'Print a short summary']);
  });

  it('prints a short summary as its own choice, and closes', () => {
    open();

    find('print-short')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.printedShort).toBe(1);
    expect(fixture.componentInstance.printed).toBe(0);
    expect(root().querySelector('[role="menu"]')).toBeNull();
  });

  it('cannot print a short summary while there is no result, like the full printout', () => {
    fixture.componentInstance.canPrint.set(false);
    fixture.detectChanges();
    open();

    expect((find('print-short') as HTMLButtonElement).disabled).toBe(true);
  });

  it('puts focus on the first choice when it opens, and closes on Escape with focus back on the button', () => {
    open();
    expect(document.activeElement).toBe(find('share-copy'));

    find('share-copy')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(root().querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(find('share-menu'));
  });

  it('moves between the choices with the arrow keys', () => {
    open();

    find('share-copy')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(find('print'));

    find('print')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(find('share-copy'));
  });

  it('closes when the button is pressed again', () => {
    open();

    open();

    expect(root().querySelector('[role="menu"]')).toBeNull();
    expect(find('share-menu')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Tab, leaving focus to move on', () => {
    open();

    find('share-copy')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    fixture.detectChanges();

    expect(root().querySelector('[role="menu"]')).toBeNull();
  });

  it('puts focus on the first choice that can be used', () => {
    fixture.componentInstance.fragment.set(null);
    fixture.detectChanges();

    open();

    expect(document.activeElement).toBe(find('print'));
  });

  it('closes when something else is clicked', () => {
    open();

    find('elsewhere')!.click();
    fixture.detectChanges();

    expect(root().querySelector('[role="menu"]')).toBeNull();
  });

  it('copies the link and closes, saying what the link holds', async () => {
    open();

    find('share-copy')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(`${location.origin}${location.pathname}#share=abc`);
    expect(root().querySelector('[role="menu"]')).toBeNull();
    expect(find('share-status')!.textContent!.replace(/\s+/g, ' ').trim())
      .toBe('Link copied. Anyone with it sees these numbers. Your income and debts are left out.');
  });

  it('prints and closes', () => {
    open();

    find('print')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.printed).toBe(1);
    expect(root().querySelector('[role="menu"]')).toBeNull();
  });

  it('cannot copy without inputs or print without a result', () => {
    fixture.componentInstance.fragment.set(null);
    fixture.componentInstance.canPrint.set(false);
    fixture.detectChanges();
    open();

    expect(find<HTMLButtonElement>('share-copy')!.disabled).toBe(true);
    expect(find<HTMLButtonElement>('print')!.disabled).toBe(true);
  });
});
