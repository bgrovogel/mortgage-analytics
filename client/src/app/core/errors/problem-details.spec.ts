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

  it("quotes a server error's request id, so it can be found in the logs", () => {
    expect(toErrorMessages(httpError(500, { title: 'An unexpected error occurred.', requestId: '7f3a9c' })))
      .toEqual(['An unexpected error occurred. Reference: 7f3a9c.']);
  });

  it("leaves the request id out of a problem the user can fix", () => {
    expect(toErrorMessages(httpError(400, { errors: { downPayment: ['Too big.'] }, requestId: '7f3a9c' }))).toEqual(['Too big.']);
  });

  it('falls back to the status code when the body is not a problem', () => {
    expect(toErrorMessages(httpError(503, null))).toEqual(['Request failed (503).']);
  });

  it('explains a network failure (status 0) in plain words', () => {
    expect(toErrorMessages(httpError(0, null))).toEqual(["We couldn't reach the server. Check your connection, then try again."]);
  });

  it('handles errors that are not HTTP errors', () => {
    expect(toErrorMessages(new Error('boom'))).toEqual(['Something went wrong. Please try again.']);
  });

  it('asks the user to sign in when the session has ended', () => {
    expect(toErrorMessages(new HttpErrorResponse({ status: 401 }))).toEqual(['Please sign in to continue.']);
  });
});

describe('a reference for the logs', () => {
  it('is given only for a server error, which is ours to fix, not for a request the user can correct', () => {
    const notFound = new HttpErrorResponse({ status: 404, error: { title: 'Not found', requestId: 'abc' } });

    expect(toErrorMessages(notFound)).toEqual(['Not found']);
  });
});
