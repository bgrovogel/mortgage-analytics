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

  it('says everything an account holds: the email, the password, passkeys, the arrangement of key figures, and what was saved', () => {
    const text = render().querySelector('#account')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('email address');
    expect(text).toContain('scrambled');
    expect(text).toContain('passkey');
    expect(text).toContain('public half');
    expect(text).toContain('order of your key figures');
    expect(text).toContain('deletes everything above');
    expect(text).toContain('download a copy');
  });

  it('says what is kept about where an account is signed in: the browser and system, and when, never an address', () => {
    const text = render().querySelector('#account')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('browser and system');
    expect(text).toContain('where you are signed in');
    expect(text).toContain('never keep your address');
  });

  it('says the server asks one public site for the week’s average rates, and sends nothing about you', () => {
    const text = render().querySelector('#none')!.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('Freddie Mac');
    expect(text).toContain('nothing about you is sent');
  });

  it('names every setting the browser keeps, and says clearing the site data removes them', () => {
    const text = render().querySelector('#browser')!.textContent!.replace(/\s+/g, ' ');

    for (const kept of ['theme', 'payment schedule', 'key figures', 'hide amounts', 'first-visit tips']) expect(text).toContain(kept);
    expect(text).toContain('Clearing the site');
  });

  it('names what the browser keeps, and says there is no tracking', () => {
    const root = render();

    expect(root.querySelector('#browser')!.textContent).toContain('theme');
    expect(root.querySelector('#none')!.textContent).toContain('No analytics');
  });
});
