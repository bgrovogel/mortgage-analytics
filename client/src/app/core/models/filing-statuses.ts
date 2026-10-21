import type { TaxFilingStatus } from './strategy.models';
import { t } from '../i18n/i18n';

/** How a household files its federal return, in the order a form lists them. */
export const FILING_STATUSES: readonly { value: TaxFilingStatus; label: string }[] = [
  { value: 'MarriedFilingJointly', get label() { return t('Married filing jointly'); } },
  { value: 'Single', get label() { return t('Single'); } },
  { value: 'HeadOfHousehold', get label() { return t('Head of household'); } },
];
