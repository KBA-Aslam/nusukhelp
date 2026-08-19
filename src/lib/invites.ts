import 'server-only';

/**
 * Invite tokens (§12, §15 — *Invite tokens: SHA-256 hashed at rest*).
 *
 * The contract is one sentence: **the plaintext token exists only in the email
 * we send, and only the hash is ever written down.** An invite link is a
 * bearer credential — whoever holds it can create an account with a role
 * attached — so a database that stored them would be a database that hands out
 * accounts to anyone who reads it, including from a backup copied onto a
 * laptop.
 *
 * SHA-256 without a salt or a work factor is the right primitive here, unlike
 * for a password. The token is 256 bits of `crypto.getRandomValues`, so there
 * is no dictionary to try and no rainbow table to build; the digest is only
 * there so that a stolen row cannot be replayed. It also has to be *fast*,
 * because the accept-invite page hashes the URL segment on every load to look
 * the row up.
 */

/** §12 — invites expire after 7 days. */
export const INVITE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * 32 bytes, base64url.
 *
 * base64url rather than hex because the token travels in a path segment: it
 * needs no percent-encoding, and it is 43 characters instead of 64, which
 * matters when the link is being read off a phone screen or copied out of a
 * mail client that wrapped it.
 */
export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** SHA-256 of the token, hex encoded. The only form that touches the database. */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** The link that goes in the email. Absolute — it is opened from a mail client. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/admin/accept-invite/${token}`;
}
