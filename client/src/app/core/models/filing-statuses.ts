import type { TaxFilingStatus } from './strategy.models';

/** How a household files its federal return, in the order a form lists them. */
export const FILING_STATUSES: readonly { value: TaxFilingStatus; label: string }[] = [
  { value: 'MarriedFilingJointly', label: 'Married filing jointly' },
  { value: 'Single', label: 'Single' },
  { value: 'HeadOfHousehold', label: 'Head of household' },
];
