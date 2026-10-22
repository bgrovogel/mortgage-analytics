import { ES_ACCOUNT } from './account';
import { ES_CALCA } from './calcA';
import { ES_CALCB } from './calcB';
import { ES_CALCFORM } from './calcform';
import { CHROME } from './chrome';
import { ES_LEARN } from './learn';
import { ES_REFINANCE } from './refinance';
import { ES_RICH } from './rich';
import { ES_SHELL } from './shell';
import { ES_STRATEGY } from './strategy';

/**
 * The app in Spanish, as a table from each English message (which is its own key) to its translation. Loaded only when
 * Spanish is chosen. Each area of the app has its own file; translations.spec.ts checks that every message has one and
 * that its placeholders ({0}, {name}) are kept.
 */
export const ES: Readonly<Record<string, string>> = {
  ...CHROME,
  ...ES_SHELL,
  ...ES_ACCOUNT,
  ...ES_CALCFORM,
  ...ES_CALCA,
  ...ES_CALCB,
  ...ES_REFINANCE,
  ...ES_STRATEGY,
  ...ES_LEARN,
  ...ES_RICH,
};
