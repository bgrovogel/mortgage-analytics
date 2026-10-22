import { t } from '../i18n/i18n';

const yearsOf = (years: number) => (years === 1 ? t('1 yr') : t('{0} yr', [years]));
const monthsOf = (months: number) => (months === 1 ? t('1 mo') : t('{0} mo', [months]));

/** 27 becomes "2 yr 3 mo"; 12 becomes "1 yr"; 0 becomes "0 mo". */
export function formatMonths(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return t('{0} {1}', [yearsOf(years), monthsOf(months)]);
  return years > 0 ? yearsOf(years) : monthsOf(months);
}
