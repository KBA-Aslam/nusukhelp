import type { StoredEnquiry } from '@/db/queries/enquiries';
import { resendApiKey } from '@/lib/server-env';
import { EMAIL } from '@/lib/site';

/**
 * Transactional email via Resend (§2, §14.2).
 *
 * ## Why `fetch` and not the SDK
 *
 * Resend's REST API is one POST with a JSON body. The Node SDK would add a
 * dependency to the Worker bundle to save four lines, and every dependency in a
 * Worker is bytes against the startup budget. The same reasoning that keeps
 * `@react-pdf/renderer` browser-side in §10.
 *
 * ## Notification, not correspondence
 *
 * This sends **to the company inbox**, never to the person who filled the form.
 * The submitter gets an on-page confirmation and nothing else: replying to a
 * public form submission by email is how a contact form becomes an open relay
 * for sending mail to arbitrary addresses, and the company answers enquiries
 * itself.
 *
 * `reply_to` is set to the enquirer so that hitting reply in the inbox does the
 * obvious thing — that is a header on a message the company already receives,
 * not a message sent to a stranger.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * The notification sender.
 *
 * **A sending subdomain, not the apex, and this is a standing rule for every
 * sender this project adds** — including the Phase 8 staff invite emails.
 * Verifying `nusukhelp.com` itself as a sending domain requires an MX record on
 * the apex, and the apex MX is reserved for real mailboxes
 * (`someone@nusukhelp.com`) the client intends to host later. Putting the
 * sending records on `send.` leaves the apex untouched, and it keeps automated
 * mail's deliverability reputation separate from the domain the company's human
 * correspondence goes out on — which is also what Resend itself recommends.
 *
 * **The subdomain must be verified in Resend before anything sends.** An
 * unverified `from` is rejected with a 403 and the notification silently stops
 * arriving. Setup is in `docs/SECRETS.md`; it is a DNS action, not a code
 * change.
 */
const FROM = 'Nusuk Help <notifications@send.nusukhelp.com>';

/** Where enquiries land. The company's published address (§1). */
const TO = EMAIL;

/**
 * Notifies the company inbox of a new enquiry.
 *
 * **Returns a boolean and never throws.** The enquiry is already stored before
 * this is called, and a Resend outage must not turn a successfully captured
 * lead into an error page that invites the customer to submit again. The
 * failure is logged for `wrangler tail`; the record is in the database either
 * way, and §13's triage queue is what the company actually works from — the
 * email is a prompt to go and look at it, not the system of record.
 */
export async function sendEnquiryNotification(
  enquiry: StoredEnquiry,
): Promise<boolean> {
  const apiKey = await resendApiKey();
  if (!apiKey) {
    console.error('enquiry notification skipped: RESEND_API_KEY is not set');
    return false;
  }

  const audienceLabel =
    enquiry.audience === 'agency' ? 'Travel agency (B2B)' : 'Pilgrim';

  // Plain text. The recipient is a colleague triaging a queue, not a marketing
  // audience, and a text body renders identically in every client including
  // the Outlook web app this inbox is on.
  const lines = [
    `New ${audienceLabel.toLowerCase()} enquiry from the website.`,
    '',
    `Audience:   ${audienceLabel}`,
    `Name:       ${enquiry.name}`,
    `Email:      ${enquiry.email}`,
    `Phone:      ${enquiry.phone || '—'}`,
    `Company:    ${enquiry.company || '—'}`,
    `Interested: ${enquiry.serviceInterest || '—'}`,
    `Language:   ${enquiry.locale}`,
    `Reference:  ${enquiry.id}`,
    '',
    'Message',
    '-------',
    enquiry.message,
  ];

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: enquiry.email,
        subject: `${audienceLabel} enquiry — ${enquiry.name}`,
        text: lines.join('\n'),
      }),
    });

    if (!response.ok) {
      console.error(
        `enquiry notification failed: ${response.status} ${await response.text()}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('enquiry notification failed', error);
    return false;
  }
}
