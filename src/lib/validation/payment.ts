import { z } from 'zod';

import {
  optionalId,
  optionalText,
  requiredDateString,
  riyals,
} from './fields';

/**
 * The payment schemas (§9.4) — shared client and server, **server
 * authoritative** (Appendix B, §15).
 *
 * ## There is only one strict schema here
 *
 * A booking has two, because a draft is a half-finished thing that must be
 * savable before it is valid (§9.10). A payment has no draft state: it is
 * either recorded or it is not, and it moves `amountPaid` the instant it
 * exists. So this parse is the gate, and it is the same gate on the client and
 * on the server.
 *
 * ## What is *not* enforced here
 *
 * Neither of the two things a person most often gets wrong — paying more than
 * the balance due, and dating a payment in the future — is a validation error.
 * Both are legitimate often enough that refusing them would be wrong (a client
 * genuinely overpays and is owed a refund; a transfer genuinely lands tomorrow),
 * and both are worth stopping to look at. They are handled the way §9.3 handles
 * the edit warnings: the action answers `kind: 'confirm'` with the sentence to
 * show, and the same submission comes back acknowledged. A rule that cannot
 * decide belongs in front of a person, not in a schema.
 */

export const recordPaymentSchema = z.object({
  /**
   * At least 1. A zero-Riyal payment is not a payment — it would appear in the
   * history, change nothing, and leave whoever reads it later wondering what
   * was meant.
   */
  amount: riyals(1, 'Enter the amount received.'),

  /**
   * When the money arrived, not when it was typed in. §13.2 recognises
   * *Received* at `paidAt`, so this is the field that decides which month a
   * payment is reported in.
   */
  paidAt: requiredDateString('Enter the date the money arrived.'),

  methodId: optionalId,
  reference: optionalText(120),
  notes: optionalText(1000),
});

export type RecordPaymentValues = z.input<typeof recordPaymentSchema>;
export type RecordPaymentParsed = z.output<typeof recordPaymentSchema>;

/**
 * Reversing (§9.4) — admin only, and a reason is required for the same reason a
 * cancellation needs one: the payment is not deleted. Both rows stay in the
 * history for as long as the business exists, and a struck-through 4,000 with
 * nothing beside it is a question nobody can answer six months later.
 */
export const reversePaymentSchema = z.object({
  reverseReason: z
    .string()
    .trim()
    .min(4, 'Give a reason — it stays in the payment history.')
    .max(500),
});

export type ReversePaymentValues = z.input<typeof reversePaymentSchema>;
