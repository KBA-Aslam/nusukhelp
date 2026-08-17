import { z } from 'zod';

import { HONEYPOT_FIELD } from '@/lib/request-guards';
import { TURNSTILE_FIELD } from '@/lib/turnstile';

/**
 * The review submission schema — shared client and server, **server
 * authoritative** (Appendix B, §15).
 *
 * One schema, imported by the form for inline validation and by the route
 * handler for the real decision. The client copy exists to give a person a
 * useful error before they submit; it is not a check, because anything reaching
 * `/api/reviews` may have skipped the form entirely.
 *
 * ## The 20-character minimum is here, not in the component
 *
 * §14.1 makes it one of the five submission protections. Putting it in the
 * schema means the endpoint enforces it whether or not a form was involved,
 * and the form gets the same rule for free.
 *
 * ## What is deliberately absent
 *
 * No `status` field. A submitter does not get to say whether their review is
 * published — the route decides `pending` or `spam` and nothing in the request
 * body can influence it (§14.1). The same goes for `ipHash`, `createdAt` and
 * `reviewedBy`: derived server-side, never accepted from a client.
 */

export const REVIEW_COMMENT_MIN = 20;
export const REVIEW_COMMENT_MAX = 2000;

export const reviewSchema = z.object({
  name: z.string().trim().min(2).max(80),
  // Stored, never rendered publicly — §14.1, and `PublicReview` has no field
  // for it. Collected so an admin can reply to a genuine reviewer.
  email: z.email().max(160),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(REVIEW_COMMENT_MIN).max(REVIEW_COMMENT_MAX),
  // Optional context, both free text: the service they used and where they are
  // from. `country` is the only one of the two that is ever published.
  serviceUsed: z.string().trim().max(80).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),

  /* Guards. Both are transport concerns rather than review content, which is
     why they are validated here but never written to the row. */
  [TURNSTILE_FIELD]: z.string().min(1).optional().or(z.literal('')),
  [HONEYPOT_FIELD]: z.string().optional(),
});

/**
 * Two types, because `rating` is coerced.
 *
 * `z.coerce.number()` accepts whatever a `<select>` gives React Hook Form — a
 * string — and produces a number. So the shape going *in* is not the shape
 * coming *out*, and React Hook Form needs both: the input type describes the
 * form's own state, the output type describes what the submit handler and the
 * API receive. Collapsing them to one `z.infer` is what makes the resolver's
 * generics disagree with the field values.
 *
 * The coercion is worth keeping for the server's sake: `/api/reviews` accepts
 * JSON from anywhere, and a rating arriving as `"5"` is a well-formed request,
 * not one to reject on a technicality.
 */
export type ReviewFormValues = z.input<typeof reviewSchema>;
export type ReviewInput = z.output<typeof reviewSchema>;
