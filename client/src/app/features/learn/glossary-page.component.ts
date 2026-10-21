import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GLOSSARY, glossaryAnchor } from '../../core/glossary/glossary';
import { ReadingNavComponent } from './reading-nav.component';
import { TPipe } from '../../core/i18n/t.pipe';

/** The words the app uses, in plain language, each with an anchor so a link can land on it. */
@Component({
  selector: 'app-glossary-page',
  imports: [ReadingNavComponent, TPipe],
  template: `
    <section class="reading" aria-labelledby="glossary-title">
      <app-reading-nav />
      <header>
        <h1 id="glossary-title">{{ 'Glossary' | t }}</h1>
        <p>{{ 'The words you will meet, in plain language.' | t }}</p>
      </header>
      <dl class="terms" data-testid="glossary">
        @for (entry of entries; track entry.term) {
          <div class="term" [id]="anchor(entry.term)">
            <dt>{{ entry.term | t }}</dt>
            <dd>{{ entry.meaning }}</dd>
          </div>
        }
      </dl>
    </section>
  `,
  styleUrl: './reading-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryPageComponent {
  protected readonly entries = GLOSSARY;
  protected readonly anchor = glossaryAnchor;
}
