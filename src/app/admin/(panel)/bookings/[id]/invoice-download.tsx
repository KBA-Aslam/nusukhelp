'use client';

import { useEffect, useRef, useState } from 'react';

import { BUTTON_PRIMARY, BUTTON_SECONDARY, FormMessage } from '@/components/admin/ui';
import { formatStatementTimestamp } from '@/lib/format';
import { invoiceFileName } from '@/lib/pdf/invoice-data';
import { AHR_MARK_SRC } from '@/lib/pdf/mark';
import { toConfidential } from '@/lib/pdf/to-confidential';
import type { InvoiceFullData, InvoiceSource } from '@/lib/pdf/types';
import { fromSeconds, nowSeconds } from '@/lib/time';

/**
 * Generate PDF (§10, §20.2).
 *
 * ## The choice is made before, and the answer is given after
 *
 * §10 requires an explicit choice of style every time, with no remembered
 * default — the cost of sending the wrong document is an agency's B2B rates in
 * an end client's inbox. So neither radio is preselected and **Generate** stays
 * disabled until someone picks one.
 *
 * That is only half of it. Phase 11's lesson was that a correct answer
 * delivered where nobody is looking is indistinguishable from no answer, and
 * here the answer is *which document you now hold*. The filename carries it,
 * but nobody reads a filename on a phone before hitting share. So generating
 * produces a panel that scrolls itself into view, is announced, and says in
 * words which style was produced and what is in it — and only then offers
 * Share. Two taps, deliberately: the second one happens after the sentence has
 * been read, and it keeps `navigator.share` inside its own user gesture, which
 * iOS Safari requires.
 *
 * Changing the selection clears that panel. A stale *"Confidential invoice
 * ready"* sitting above a newly chosen **Full invoice** radio is exactly the
 * confusion this screen exists to prevent.
 *
 * ## Failures are shown, never swallowed
 *
 * Anything that goes wrong in rendering lands in an error message that says
 * nothing was produced. There is no fallback to the other style, ever: a
 * confidential download that quietly came out full is the failure with the
 * highest cost on this project.
 *
 * ## Why the browser holds the priced object
 *
 * The page passes the full booking data down and `toConfidential` runs here,
 * because §10 renders browser-side and the staff member is already looking at
 * every one of those figures on the screen behind this card. Confidentiality is
 * about the document's *recipient*, not the operator. What must never happen —
 * and cannot, by type — is priced data reaching the confidential document.
 */

type InvoiceStyle = 'full' | 'confidential';

type ReadyDocument = {
  style: InvoiceStyle;
  fileName: string;
  /** The header line the document itself carries, repeated on screen. */
  stamp: string;
  url: string;
  file: File;
  shareable: boolean;
};

export function InvoiceDownload({
  source,
  statusNote,
}: {
  source: InvoiceSource;
  /** Said out loud on the card when the booking is in an odd state. */
  statusNote?: string;
}) {
  const [choice, setChoice] = useState<InvoiceStyle | null>(null);
  const [ready, setReady] = useState<ReadyDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // A blob URL outlives the component unless it is revoked by hand, and this
  // screen can generate a dozen documents in a sitting.
  useEffect(() => {
    if (!ready) return;
    return () => URL.revokeObjectURL(ready.url);
  }, [ready]);

  function select(style: InvoiceStyle) {
    setChoice(style);
    setReady(null);
    setError(null);
  }

  async function generate() {
    if (!choice || pending) return;

    setPending(true);
    setError(null);
    setReady(null);

    try {
      // Stamped at the tap, not at page render: the header line is what tells
      // two downloads of one booking number apart (§10).
      const generatedAt = nowSeconds();
      const full: InvoiceFullData = { ...source, generatedAt };

      // Both imports are dynamic so that `@react-pdf/renderer` — the largest
      // dependency in the panel — is fetched when someone actually generates,
      // not on every visit to a booking. Only the chosen document is loaded.
      const { pdf } =
        await import('@react-pdf/renderer');

      const element =
        choice === 'confidential'
          ? await (async () => {
              const { InvoiceConfidentialDocument } = await import(
                '@/components/pdf/invoice-confidential-document'
              );
              return (
                <InvoiceConfidentialDocument
                  data={toConfidential(full)}
                  markSrc={AHR_MARK_SRC}
                />
              );
            })()
          : await (async () => {
              const { InvoiceFullDocument } = await import(
                '@/components/pdf/invoice-full-document'
              );
              return <InvoiceFullDocument data={full} markSrc={AHR_MARK_SRC} />;
            })();

      const blob = await pdf(element).toBlob();
      const fileName = invoiceFileName(source.bookingNumber, choice);
      const file = new File([blob], fileName, { type: 'application/pdf' });

      setReady({
        style: choice,
        fileName,
        stamp: formatStatementTimestamp(fromSeconds(generatedAt)),
        url: URL.createObjectURL(blob),
        file,
        shareable:
          typeof navigator !== 'undefined' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] }),
      });
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? `The PDF could not be produced — ${cause.message}. Nothing was downloaded.`
          : 'The PDF could not be produced. Nothing was downloaded.',
      );
    } finally {
      setPending(false);
    }
  }

  async function share() {
    if (!ready) return;
    try {
      await navigator.share({ files: [ready.file], title: ready.fileName });
    } catch (cause) {
      // Dismissing the share sheet is not a failure and must not read as one.
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setError(
        'The share sheet could not be opened. Use Save PDF instead — the file is ready.',
      );
    }
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      {statusNote ? (
        <p className="mb-3 text-xs text-muted">{statusNote}</p>
      ) : null}

      <fieldset>
        <legend className="text-xs tracking-wide text-muted uppercase">
          Choose the style, every time
        </legend>

        <div className="mt-2.5 space-y-2">
          <StyleChoice
            id="invoice-style-full"
            checked={choice === 'full'}
            onSelect={() => select('full')}
            title="Full invoice"
            detail="Shows all amounts — rates, total, paid, balance, bank details."
          />
          <StyleChoice
            id="invoice-style-confidential"
            checked={choice === 'confidential'}
            onSelect={() => select('confidential')}
            title="Confidential invoice"
            detail="Hides all amounts. Safe to send to a client who must not see B2B rates."
          />
        </div>
      </fieldset>

      <div className="mt-3.5">
        <button
          type="button"
          onClick={generate}
          disabled={!choice || pending}
          className={BUTTON_PRIMARY}
        >
          {pending ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error ? (
        <div className="mt-3.5">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}

      {ready ? <ReadyPanel document={ready} onShare={share} /> : null}
    </div>
  );
}

/**
 * What was produced, said in words.
 *
 * `role="status"`, focused and scrolled into view on mount, for the same reason
 * `WarningPanel` does it: the button that triggers this is routinely a
 * screenful away on a phone, and an answer nobody sees is no answer. The style
 * is named first and in full, before the filename, because the filename is what
 * people skip.
 */
function ReadyPanel({
  document: doc,
  onShare,
}: {
  document: ReadyDocument;
  onShare: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.focus({ preventScroll: true });
  }, []);

  const confidential = doc.style === 'confidential';

  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      className={`mt-3.5 rounded-[2px] border px-4 py-3.5 outline-none ${
        confidential
          ? 'border-verdant/30 bg-verdant/5'
          : 'border-brass/40 bg-brass/5'
      }`}
    >
      <p className="text-sm font-semibold text-ink">
        {confidential
          ? 'Confidential invoice ready — no amounts in it.'
          : 'Full invoice ready — every amount is in it.'}
      </p>
      <p className="mt-1 text-xs text-muted">
        {confidential
          ? 'No rates, no total, no paid or balance figure, no bank details. Safe to send to the end client.'
          : 'Rates, total, paid, balance and bank details are all shown, including B2B rates. Do not send this to an end client.'}
      </p>
      <p className="mt-1.5 text-xs text-muted">
        {doc.fileName} · Statement as of {doc.stamp}
      </p>

      <div className="mt-3 flex flex-wrap gap-2.5">
        {doc.shareable ? (
          <button type="button" onClick={onShare} className={BUTTON_PRIMARY}>
            Share
          </button>
        ) : null}
        {/* §20.2 — the fallback, and on iOS Safari an unreliable one, which is
            why sharing is the primary path where the browser supports it. */}
        <a
          href={doc.url}
          download={doc.fileName}
          className={BUTTON_SECONDARY}
        >
          Save PDF
        </a>
      </div>
    </div>
  );
}

/** A radio with a 44px target and its explanation inside the label (§20.3). */
function StyleChoice({
  id,
  checked,
  onSelect,
  title,
  detail,
}: {
  id: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-[2px] border px-3.5 py-3 ${
        checked ? 'border-verdant bg-verdant/5' : 'border-hairline bg-white'
      }`}
    >
      <input
        type="radio"
        id={id}
        name="invoice-style"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-verdant"
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </label>
  );
}
