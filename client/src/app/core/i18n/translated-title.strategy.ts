import { Injectable, effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { currentLanguage, t } from './i18n';

/**
 * Sets the browser tab's title from the route's `title`: the page's name in the page's language, then the app's name.
 * The routes hold the names in English; when the language changes the title is written again, without a navigation.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private page: string | undefined;

  constructor() {
    super();
    effect(() => {
      currentLanguage();
      this.write();
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.page = this.buildTitle(snapshot);
    this.write();
  }

  private write(): void {
    if (this.page !== undefined) this.title.setTitle(t('{0} · Mortgage Analytics', [t(this.page)]));
  }
}
