import { decimal } from '../../core/formatting/format';
import { t } from '../../core/i18n/i18n';

/** How far prices fall in the second case an answer is worked out under, when nothing else says: the first is flat prices. */
export const USUAL_FALL = 3;

/** The yearly changes in value an answer is worked out under, for a fall: that fall and flat prices (or flat alone when there is no fall). */
export const changesFor = (fall: number): number[] => (fall > 0 ? [-fall, 0] : [0]);

/** The fall in some yearly changes in value: the first of them that is a fall, or none. */
export const fallOf = (changes: readonly number[] | undefined): number => Math.abs(changes?.find((change) => change < 0) ?? 0);

/** A scenario's name: "Prices fall 3% a year", "Prices stay flat" or "Prices rise 5% a year". */
export function scenarioLabel(change: number): string {
  if (change === 0) return t('Prices stay flat');
  const percent = `${decimal(Math.abs(change))}%`;
  return change < 0 ? t('Prices fall {0} a year', [percent]) : t('Prices rise {0} a year', [percent]);
}
