import { HttpErrorResponse } from '@angular/common/http';

/** RFC 9457 problem details, as returned by the API for every error. */
interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

/** Flattens any HTTP failure into messages a person can act on. */
export function toErrorMessages(error: unknown): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return ['Something went wrong. Please try again.'];
  }

  if (error.status === 0) {
    return ['The server could not be reached. Is the API running?'];
  }

  const problem = (error.error ?? {}) as ProblemDetails;
  const fieldErrors = Object.values(problem.errors ?? {}).flat();
  if (fieldErrors.length > 0) {
    return fieldErrors;
  }

  return [problem.detail ?? problem.title ?? `Request failed (${error.status}).`];
}
