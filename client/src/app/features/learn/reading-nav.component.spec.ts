import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { ReadingNavComponent } from './reading-nav.component';

@Component({ template: '<app-reading-nav />', imports: [ReadingNavComponent] })
class HostComponent {}

@Component({ template: '' })
class BlankComponent {}

describe('ReadingNavComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([
        { path: 'glossary', component: HostComponent },
        { path: 'how-it-works', component: BlankComponent },
        { path: 'privacy', component: BlankComponent },
      ])],
    });
  });

  it('links the three pages that explain the app, and marks the one open', async () => {
    const harness = await RouterTestingHarness.create('/glossary');
    const root = harness.routeNativeElement as HTMLElement;
    const links = [...root.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Pages that explain it"] a')];

    expect(links.map((a) => [a.textContent!.trim(), a.getAttribute('href'), a.getAttribute('aria-current')])).toEqual([
      ['How it’s calculated', '/how-it-works', null],
      ['Glossary', '/glossary', 'page'],
      ['Privacy', '/privacy', null],
    ]);
  });
});
