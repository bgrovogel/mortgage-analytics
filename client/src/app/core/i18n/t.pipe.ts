import { Pipe, PipeTransform } from '@angular/core';
import { MessageParams, t } from './i18n';

/**
 * `{{ 'Your account' | t }}`, or `{{ 'Signed in as {0}' | t: [email] }}`: a message of the template in the page's
 * language. Impure on purpose, so it is asked again when the language changes (the language is a signal that the template
 * reads, which also marks it for a new check); a lookup in a table is as cheap as the check it adds to.
 */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(message: string, params?: MessageParams): string {
    return t(message, params);
  }
}
