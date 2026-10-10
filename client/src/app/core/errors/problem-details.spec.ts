import { HttpErrorResponse } from '@angular/common/http';
import { toErrorMessages } from './problem-details';

describe('toErrorMessages', () => {
  const httpError = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

  it('flattens field-level validation errors into one list', () => {
    const error = httpError(400, {
      title: 'One or more validation errors occurred.',
      errors: { downPayment: ['Too big.'], 'extraPayments.lumpSums[0].amount': ['Too large.', 'Not cents.'] },
    });

    expect(toErrorMessages(error)).toEqual(['Too big.', 'Too large.', 'Not cents.']);
  });

  it('prefers the problem detail over the title when there are no field errors', () => {
    expect(toErrorMessages(httpError(422, { title: 'Unprocessable', detail: 'Principal must be positive.' }))).toEqual([
      'Principal must be positive.',
    ]);
  });

  it('falls back to the problem title', () => {
    expect(toErrorMessages(httpError(500, { title: 'An unexpected error occurred.' }))).toEqual(['An unexpected error occurred.']);
  });

  it('falls back to the status code when the body is not a problem', () => {
    expect(toErrorMessages(httpError(503, null))).toEqual(['Request failed (503).']);
  });

  it('explains a network failure (status 0) in plain words', () => {
    expect(toErrorMessages(httpError(0, null))).toEqual(['The server could not be reached. Is the API running?']);
  });

  it('handles errors that are not HTTP errors', () => {
    expect(toErrorMessages(new Error('boom'))).toEqual(['Something went wrong. Please try again.']);
  });

  it('asks the user to sign in when the session has ended', () => {
    expect(toErrorMessages(new HttpErrorResponse({ status: 401 }))).toEqual(['Please sign in to continue.']);
  });
});
