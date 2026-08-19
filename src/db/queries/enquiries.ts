import { and, count, eq, gte } from 'drizzle-orm';

import type { EnquiryAudience } from '@/lib/validation/enquiry';
import { nowSeconds } from '@/lib/time';

import { getDb } from '../index';
import { enquiries } from '../schema';

/**
 * Enquiry writes (§14.2).
 *
 * There is no public *read* here, and there should not be one. An enquiry is a
 * private message to the company — it goes to the admin panel's triage queue
 * (§13) and to the notification inbox, and nothing on the public site ever
 * renders one. Reviews need a `PublicReview` type precisely because they are
 * published; enquiries need no such type because they are not.
 */

/**
 * How many enquiries this IP hash has submitted since `since`.
 *
 * §14.2 asks for the same protections as reviews, so this is the same 3-per-24h
 * allowance over the same window, counted the same way. The two tables are
 * separate buckets: someone who has left three reviews can still send an
 * enquiry, because the abuse the limit targets is repetition of one kind of
 * submission, and a genuine customer doing both is not a bot.
 */
export async function countEnquiriesByIpSince(
  ipHash: string,
  since: number,
): Promise<number> {
  const db = getDb();

  const [row] = await db
    .select({ total: count() })
    .from(enquiries)
    .where(and(eq(enquiries.ipHash, ipHash), gte(enquiries.createdAt, since)));

  return row?.total ?? 0;
}

export type StoredEnquiry = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  audience: EnquiryAudience;
  serviceInterest: string | null;
  message: string;
  locale: string;
  createdAt: number;
};

/**
 * Stores an enquiry and returns the row as written.
 *
 * The row is returned rather than discarded because the notification email is
 * built from it (§14.2), and the email must describe what was **stored** — not
 * what was submitted. If the two ever diverge, the inbox is the copy a person
 * acts on, and it should not be able to describe a record that does not exist.
 *
 * `status` is not a parameter: every enquiry enters as `new`, which is the
 * column default and the only correct starting state for a triage queue.
 */
export async function insertEnquiry(input: {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  audience: EnquiryAudience;
  serviceInterest: string | null;
  message: string;
  locale: string;
  ipHash: string;
}): Promise<StoredEnquiry> {
  const db = getDb();

  const row = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: nowSeconds(),
  };

  await db.insert(enquiries).values(row);

  /*
   * The hash does not travel with the returned row.
   *
   * `StoredEnquiry` is what the notification email is built from, and an IP
   * hash has no business in an inbox — it is a rate-limiting key, not enquiry
   * content. Dropping it here rather than trusting the email template not to
   * print it is the same allow-list reflex as `PublicReview` having no email
   * field: the type makes the leak impossible instead of unlikely.
   */
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    audience: row.audience,
    serviceInterest: row.serviceInterest,
    message: row.message,
    locale: row.locale,
    createdAt: row.createdAt,
  };
}
