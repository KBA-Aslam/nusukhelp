import { z } from 'zod';

import { HONEYPOT_FIELD } from '@/lib/request-guards';
import { TURNSTILE_FIELD } from '@/lib/turnstile';

/**
 * The enquiry submission schema — shared client and server, server
 * authoritative (Appendix B, §15).
 *
 * ## The audience split is the point of this form (§14.2)
 *
 * `audience` decides how the enquiry is triaged and what the notification email
 * says, so it is a required enum rather than an optional hint. The two values
 * are the `enquiries.audience` column's own — `pilgrim` and `agency` — and they
 * are the same two ids `CONTACT_AUDIENCES` uses to key the copy, so the form's
 * two panels and the database column cannot drift apart.
 *
 * `company` matters only for an agency and is optional for both: requiring it
 * of agencies at the schema level would reject a sole trader who left it blank,
 * which is a real customer turned away by a form. Triage is a human reading the
 * message.
 */

export const ENQUIRY_MESSAGE_MIN = 20;
export const ENQUIRY_MESSAGE_MAX = 4000;

export const ENQUIRY_AUDIENCES = ['pilgrim', 'agency'] as const;
export type EnquiryAudience = (typeof ENQUIRY_AUDIENCES)[number];

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(160),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  audience: z.enum(ENQUIRY_AUDIENCES),
  serviceInterest: z.string().trim().max(80).optional().or(z.literal('')),
  message: z.string().trim().min(ENQUIRY_MESSAGE_MIN).max(ENQUIRY_MESSAGE_MAX),

  [TURNSTILE_FIELD]: z.string().min(1).optional().or(z.literal('')),
  [HONEYPOT_FIELD]: z.string().optional(),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
