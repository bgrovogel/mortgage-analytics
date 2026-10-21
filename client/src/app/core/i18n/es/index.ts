import { ES_SHELL } from './shell';

/**
 * The app in Spanish, as a table from each English message (which is its own key) to its translation. Loaded only when
 * Spanish is chosen. Each area of the app has its own file below. A placeholder, {0} or {name}, stays as written.
 */
export const ES: Readonly<Record<string, string>> = { ...ES_SHELL };
