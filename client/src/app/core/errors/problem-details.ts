import { HttpErrorResponse } from '@angular/common/http';

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
    return ['Something went wrong. Please try again.'];
  }

  if (error.status === 0) {
    return ["We couldn't reach the server. Check your connection, then try again."];
  }

  if (error.status === 401) {
    return ['Please sign in to continue.'];
  }

  const problem = (error.error ?? {}) as ProblemDetails;
  const fieldErrors = Object.values(problem.errors ?? {}).flat();
  if (fieldErrors.length > 0) {
    return fieldErrors;
  }

  const message = problem.detail ?? problem.title ?? `Request failed (${error.status}).`;
  // A server error is ours to fix: its id finds it in the logs, so the user can quote it.
  return [error.status >= 500 && problem.requestId ? `${message} Reference: ${problem.requestId}.` : message];
}
