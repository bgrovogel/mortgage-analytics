import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RichTextComponent } from './rich-text.component';

@Component({
  imports: [RichTextComponent],
  template: `<p class="host"><app-rich [message]="message" /></p>`,
})
class HostComponent {
  message = 'Words in the [link:/glossary]glossary[/link]: a [b][term:PMI]PMI[/term][/b] and [b]6%[/b].';
}

describe('RichTextComponent', () => {
  it('draws a sentence with its link, glossary term and bold words in place, in one paragraph', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector('p.host') as HTMLElement;

    expect(p.textContent!.replace(/\s+/g, ' ').trim()).toBe('Words in the glossary: a PMI and 6%.');
    expect(p.querySelector('a[href="/glossary"]')?.textContent).toBe('glossary');
    expect(p.querySelector('strong app-term a')?.textContent?.trim()).toBe('PMI');
    expect([...p.querySelectorAll('strong')].map((s) => s.textContent!.trim())).toEqual(['PMI', '6%']);
  });
});
