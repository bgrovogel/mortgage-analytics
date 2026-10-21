import { formatDate } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { dateLocale } from '../formatting/format';

/**
 * Angular's `date` pipe, with the names of months and days in the page's language. It has the same name and the same
 * arguments, so a template only changes where it imports it from. Impure on purpose, as the `t` pipe is: it reads the
 * language signal, so it is asked again when the language changes.
 */
@Pipe({ name: 'date', pure: false })
export class DatePipe implements PipeTransform {
  transform(value: Date | string | number | null | undefined, format = 'mediumDate', timezone?: string): string | null {
    if (value === null || value === undefined || value === '') return null;
    return formatDate(value, format, dateLocale(), timezone);
  }
}
