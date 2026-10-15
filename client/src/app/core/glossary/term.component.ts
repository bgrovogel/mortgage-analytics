import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GLOSSARY, glossaryAnchor } from './glossary';

/**
 * A word the glossary defines, in running text: a link to its entry, with the meaning on hover. For read-only text;
 * inside a label or a button a click would navigate away from what the reader meant to press, so those keep an `<abbr>`.
 */
@Component({
  selector: 'app-term',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <!-- Projected once: content can only land in one place, so both branches show it through this template. -->
    <ng-template #words><ng-content /></ng-template>
    @if (entry(); as e) {
      <a class="term" routerLink="/glossary" [fragment]="anchor()" [title]="e.meaning"><ng-container *ngTemplateOutlet="words" /></a>
    } @else {
      <ng-container *ngTemplateOutlet="words" />
    }
  `,
  styles: `
    .term {
      color: inherit;
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }

    .term:hover {
      color: var(--accent-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermComponent {
  /** The glossary term the words stand for, as the glossary spells it. */
  readonly of = input.required<string>();

  protected readonly entry = computed(() => GLOSSARY.find((e) => e.term === this.of()));
  protected readonly anchor = computed(() => glossaryAnchor(this.of()));
}
