import { t } from '../i18n/i18n';
import { AmortizationRequest, AmortizationResponse } from './amortization.models';

/** The most homes compared at once: Home A and up to three more. */
export const MAX_HOMES = 4;

/** "Home A", "Home B"…: a home's name by its place in the comparison. */
export const homeName = (index: number) => t('Home {0}', [String.fromCharCode(65 + index)]);

/**
 * Two to four homes compared, each a full calculator request: any input can differ. The API calculates each on its
 * own; saved, the first is a calculation's `inputs` and the rest its `otherHomes`.
 */
export interface HomeComparisonRequest {
  homes: AmortizationRequest[];
}

/** The calculator's results for each home, in the same order. */
export interface HomeComparisonResponse {
  homes: AmortizationResponse[];
}
