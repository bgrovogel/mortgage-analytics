import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TermComponent } from '../../core/glossary/term.component';
import { RichNode, parseRich } from './rich-text';

/**
 * A message with a little markup in it (see `parseRich`), drawn inside a paragraph: bold words, links and glossary terms in place.
 * The sentence is one message, so it translates as one sentence, with its bold words, links and glossary terms where the
 * translation wants them.
 */
@Component({
  selector: 'app-rich',
  imports: [NgTemplateOutlet, RouterLink, TermComponent],
  template: `
    <ng-template #nodes let-list>
      @for (node of list; track $index) {
        @switch (node.kind) {
          @case ('text') {{{ node.text }}}
          @case ('bold') {<strong><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></strong>}
          @case ('link') {<a [routerLink]="node.to"><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></a>}
          @case ('term') {<app-term [of]="node.of"><ng-container *ngTemplateOutlet="nodes; context: { $implicit: node.children }" /></app-term>}
        }
      }
    </ng-template>
    <ng-container *ngTemplateOutlet="nodes; context: { $implicit: parsed() }" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextComponent {
  /** The message, with its markup. */
  readonly message = input.required<string>();

  protected readonly parsed = computed<RichNode[]>(() => parseRich(this.message()));
}
