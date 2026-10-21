import { HttpErrorResponse } from '@angular/common/http';
import { t } from '../i18n/i18n';

/** RFC 9457 problem details, as returned by the API for every error. */
interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  /** The request's id, also in its X-Request-ID header and on every log line it wrote. */
  requestId?: string;
}

/** Flattens any HTTP failure into messages a person can act on. */
export function toErrorMessages(error: unknown): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [t('Something went wrong. Please try again.')];
  }

  if (error.status === 0) {
    return [t("We couldn't reach the server. Check your connection, then try again.")];
  }

  if (error.status === 401) {
    return [t('Please sign in to continue.')];
  }

  const problem = (error.error ?? {}) as ProblemDetails;
  const fieldErrors = Object.values(problem.errors ?? {}).flat();
  if (fieldErrors.length > 0) {
    return fieldErrors;
  }

  const message = problem.detail ?? problem.title ?? t('Request failed ({0}).', [error.status]);
  // A server error is ours to fix: its id finds it in the logs, so the user can quote it.
  return [error.status >= 500 && problem.requestId ? t('{0} Reference: {1}.', [message, problem.requestId]) : message];
}
