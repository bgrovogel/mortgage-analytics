import { APIRequestContext, expect } from '@playwright/test';

/** An email as the development mailbox lists it. */
export interface Email {
  to: string;
  subject: string;
  actionUrl: string;
}

/**
 * Waits for the newest email to `address` in the development mailbox (the API keeps sent email in a local
 * outbox when no mail server is configured, and lists it in Development) and returns it.
 */
export async function latestEmailTo(request: APIRequestContext, address: string, subject?: string): Promise<Email> {
  let found: Email | undefined;
  await expect
    .poll(async () => {
      const response = await request.get('/api/v1/dev/outbox');
      const emails: unknown = response.ok() ? await response.json() : [];
      found = (Array.isArray(emails) ? (emails as Email[]) : []).find((e) => e.to === address && (!subject || e.subject === subject));
      return found !== undefined;
    }, { message: `an email to ${address} arrives in the dev mailbox`, timeout: 10_000 })
    .toBe(true);
  return found!;
}

/** The path and query of an email's link, to open on the app under test (whatever host the email names). */
export function pathOf(email: Email): string {
  const url = new URL(email.actionUrl);
  return url.pathname + url.search;
}
