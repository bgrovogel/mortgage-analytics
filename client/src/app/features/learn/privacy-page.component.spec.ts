import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyPageComponent } from './privacy-page.component';

describe('PrivacyPageComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  const render = () => {
    const fixture = TestBed.createComponent(PrivacyPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('answers what happens to what you type, by whether you have an account', () => {
    const headings = [...render().querySelectorAll('article h3')].map((h) => h.textContent!.trim());

    expect(headings).toEqual([
      'Without an account', 'Share links', 'With an account', 'In your browser', 'What is not here',
    ]);
  });

  it('says plainly that nothing typed is saved without an account', () => {
    const text = render().querySelector('#anonymous')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('does not save');
  });

  it('says a share link leaves out income and debts, and that deleting the account deletes what was saved', () => {
    const root = render();

    expect(root.querySelector('#links')!.textContent).toContain('income and debts');
    expect(root.querySelector('#account')!.textContent).toContain('delete your account');
  });

  it('names what the browser keeps, and says there is no tracking', () => {
    const root = render();

    expect(root.querySelector('#browser')!.textContent).toContain('theme');
    expect(root.querySelector('#none')!.textContent).toContain('No analytics');
  });
});
