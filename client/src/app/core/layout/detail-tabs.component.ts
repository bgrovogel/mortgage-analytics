import { ChangeDetectionStrategy, Component, ElementRef, inject, input, model } from '@angular/core';

/** One view among a page's details. */
export interface DetailTab {
  value: string;
  label: string;
}

let nextId = 0;

/**
 * A page's details, one view at a time: a tab list (arrow keys, Home and End move between the tabs; only the
 * selected one is in the tab order) over a panel the page fills for the selected tab. Each tab button carries
 * `data-testid="tab-<value>"`.
 *
 * `<app-detail-tabs label="Details" [tabs]="tabs" [(selected)]="tab">@switch (tab()) { … }</app-detail-tabs>`
 */
@Component({
  selector: 'app-detail-tabs',
  template: `
    <div class="tabs" role="tablist" [attr.aria-label]="label()">
      @for (option of tabs(); track option.value) {
        <button type="button" role="tab" [id]="id + '-' + option.value" [attr.aria-controls]="id + '-panel'"
                [attr.aria-selected]="selected() === option.value" [attr.tabindex]="selected() === option.value ? 0 : -1"
                [attr.data-testid]="'tab-' + option.value" (click)="selected.set(option.value)" (keydown)="onKey($event)">
          {{ option.label }}
        </button>
      }
    </div>
    <div class="tab-body" role="tabpanel" [id]="id + '-panel'" [attr.aria-labelledby]="id + '-' + selected()">
      <ng-content />
    </div>
  `,
  styleUrl: './detail-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailTabsComponent {
  /** What the tab list is called, for assistive technology. */
  readonly label = input.required<string>();

  /** The views, in order. */
  readonly tabs = input.required<readonly DetailTab[]>();

  /** The value of the tab shown. */
  readonly selected = model.required<string>();

  protected readonly id = `detail-tabs-${nextId++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Arrow keys, Home and End move to a tab and select it, as a tab list is expected to. */
  protected onKey(event: KeyboardEvent): void {
    const values = this.tabs().map((t) => t.value);
    const at = values.indexOf(this.selected());
    const next = {
      ArrowRight: (at + 1) % values.length,
      ArrowLeft: (at - 1 + values.length) % values.length,
      Home: 0,
      End: values.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this.selected.set(values[next]);
    this.host.nativeElement.querySelector<HTMLElement>(`#${this.id}-${values[next]}`)?.focus();
  }
}
