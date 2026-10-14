import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShareLinkComponent } from './share-link.component';

describe('ShareLinkComponent', () => {
  let fixture: ComponentFixture<ShareLinkComponent>;
  let writeText: jest.Mock;

  const create = (fragment: string | null = 'share=abc', note: string | null = 'Your income and debts are left out.') => {
    fixture = TestBed.createComponent(ShareLinkComponent);
    fixture.componentRef.setInput('fragment', fragment);
    fixture.componentRef.setInput('note', note);
    fixture.detectChanges();
  };
  const root = () => fixture.nativeElement as HTMLElement;
  const find = <T extends HTMLElement>(id: string) => root().querySelector<T>(`[data-testid="${id}"]`);
  const text = (id: string) => find(id)?.textContent?.replace(/\s+/g, ' ').trim();
  const copy = async () => {
    find<HTMLButtonElement>('share-copy')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('copies a link to this page with the inputs in its fragment, and says what it holds', async () => {
    create();
    await copy();

    expect(writeText).toHaveBeenCalledWith(`${location.origin}${location.pathname}#share=abc`);
    expect(text('share-status')).toBe('Link copied. Anyone with it sees these numbers. Your income and debts are left out.');
  });

  it('says nothing more when the link is simply the inputs', async () => {
    create('share=abc', null);
    await copy();

    expect(text('share-status')).toBe('Link copied. Anyone with it sees these numbers.');
  });

  it('stops saying the link was copied once the inputs change', async () => {
    create();
    await copy();
    fixture.componentRef.setInput('fragment', 'share=def');
    fixture.detectChanges();

    expect(find('share-status')).toBeNull();
  });

  it('shows the link to copy by hand when the clipboard cannot be used', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    create();
    await copy();

    expect(find<HTMLInputElement>('share-url')!.value).toBe(`${location.origin}${location.pathname}#share=abc`);
    expect(text('share-manual')).toContain('Copy this link: anyone with it sees these numbers. Your income and debts are left out.');
    expect(find('share-status')).toBeNull();
  });

  it('cannot copy before there are inputs', () => {
    create(null);

    expect(find<HTMLButtonElement>('share-copy')!.disabled).toBe(true);
  });
});
