import { renderToBuffer } from '@react-pdf/renderer';
import { extractText, getDocumentProxy } from 'unpdf';
import { describe, expect, it } from 'vitest';

import { InvoiceConfidentialDocument } from '@/components/pdf/invoice-confidential-document';
import { InvoiceFullDocument } from '@/components/pdf/invoice-full-document';
import { amountInWords } from '@/lib/pdf/amount-in-words';
import { invoiceFileName } from '@/lib/pdf/invoice-data';
import { toConfidential } from '@/lib/pdf/to-confidential';

import { AMOUNTS, FULL, IBAN, MARK } from './helpers/invoice-fixture';

/**
 * The confidential invoice, checked the only way it can honestly be checked
 * (§10): by reading the **text layer** of a rendered PDF.
 *
 * Looking at the render proves nothing. A figure can be white on white, behind
 * a box, clipped outside the page, or present in the content stream while
 * invisible on screen — and all four are still selectable, copyable, greppable
 * and extractable by the recipient. So these tests render real PDFs through
 * `@react-pdf/renderer`, pull the text back out with `unpdf`, and assert on
 * what a client could actually get at.
 *
 * ## The detector is proven to fire
 *
 * A leak test that has never failed proves nothing either. `moneyLeaks` is run
 * over **both** documents in this suite: it must come back empty for the
 * confidential style and non-empty for the full one, which is rendered from the
 * same fixture through the same pipeline. If the extraction ever silently
 * breaks — a react-pdf upgrade, a font change, an unpdf change — the full
 * invoice assertion goes red rather than the confidential one going quietly
 * green.
 *
 * That was confirmed by hand as well, once, in the way the client asked for: a
 * `pricePerNight` line was temporarily added to `InvoiceConfidentialDocument`
 * (with the type widened to let it compile) and this suite was run. It failed,
 * naming `SAR 1,750` and `1,750`. The line was then removed. See §10, *Phase 12
 * rulings*.
 */

/* --------------------------------------------------------------------------
   The detector
   -------------------------------------------------------------------------- */

const MONEY_WORDS = [
  'SAR',
  'IBAN',
  'Bank details',
  'Rooms subtotal',
  'Services subtotal',
  'Discount',
  'TOTAL VALUE',
  'Amount paid',
  'Balance due',
  'Payment status',
  'Rate / night',
  'Unit price',
  'Saudi Riyals Only',
];

/** Every way one of the fixture's figures could appear in a text layer. */
function amountSpellings(value: number): string[] {
  return [
    String(value),
    new Intl.NumberFormat('en-u-nu-latn').format(value),
    amountInWords(value),
  ];
}

/**
 * Letter-spaced headings come out of the text layer with a space between every
 * glyph — `TOTAL VALUE` extracts as `T O TA L VA L U E`. Stripping whitespace
 * before matching means a leak cannot hide behind tracking.
 */
function despace(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/**
 * Everything money-shaped in a PDF's text layer.
 *
 * Returns the offending strings rather than a boolean, so a failure names what
 * leaked instead of only asserting that something did.
 */
function moneyLeaks(text: string): string[] {
  const haystack = text.toLowerCase();
  const squashed = despace(text);
  const found = new Set<string>();

  for (const word of MONEY_WORDS) {
    if (haystack.includes(word.toLowerCase()) || squashed.includes(despace(word))) {
      found.add(word);
    }
  }

  for (const value of Object.values(AMOUNTS)) {
    for (const spelling of amountSpellings(value)) {
      if (
        haystack.includes(spelling.toLowerCase()) ||
        squashed.includes(despace(spelling))
      ) {
        found.add(spelling);
      }
    }
  }

  for (const fragment of IBAN.split(' ')) {
    if (fragment.length >= 4 && squashed.includes(despace(fragment))) {
      found.add(fragment);
    }
  }

  return [...found];
}

type RenderableDocument = Parameters<typeof renderToBuffer>[0];

async function textLayerOf(element: RenderableDocument): Promise<string> {
  const buffer = await renderToBuffer(element);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

/* --------------------------------------------------------------------------
   Tests
   -------------------------------------------------------------------------- */

describe('the confidential invoice carries no amounts (§10)', () => {
  it('has nothing money-shaped in its text layer', async () => {
    const text = await textLayerOf(
      <InvoiceConfidentialDocument data={toConfidential(FULL)} markSrc={MARK} />,
    );

    expect(moneyLeaks(text)).toEqual([]);
  });

  it('still says everything §10 requires it to say', async () => {
    const text = await textLayerOf(
      <InvoiceConfidentialDocument data={toConfidential(FULL)} markSrc={MARK} />,
    );

    // Identity and the generation stamp — the line that tells two downloads of
    // one booking number apart.
    expect(text).toContain('AHR-2026-00041');
    expect(text).toContain('Statement as of 22 Aug 2026, 14:30');

    // Parties, stay, rooms and services, in counts only.
    expect(text).toContain('Baitul Umrah Travels');
    expect(text).toContain('Yusuf Adeyemi');
    expect(text).toContain('Anwar Al Madinah Movenpick');
    expect(text).toContain('CNF-88213');
    expect(text).toContain('BRN-77120');
    expect(text).toContain('Double Deluxe');
    expect(text).toContain('BB');
    expect(text).toContain('Ziyarat transport');

    // Terms and declaration in full (§11), and the VAT disclaimer (§9.9).
    expect(text).toContain('Payment & Confirmation');
    expect(despace(text)).toContain('declaration');
    expect(text).toContain('acknowledges and agrees');
    expect(text).toContain('Not a tax invoice');

    // Never "Tax Invoice" as a title (Appendix A).
    // Appendix A forbids *titling* the document "Tax Invoice"; §9.9 requires
    // the footer to say it is not one. Both are asserted by looking only at
    // the upper-case runs, which is where headings live.
    const headings = despace(text.replace(/[a-z]/g, ''));
    expect(headings).toContain('invoice');
    expect(headings).not.toContain('taxinvoice');
    expect(text).toContain('Not a tax invoice. The company is not VAT-registered.');
  });

  it('renders one A4 page, at A4 dimensions', async () => {
    const buffer = await renderToBuffer(
      <InvoiceConfidentialDocument data={toConfidential(FULL)} markSrc={MARK} />,
    );
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const page = await pdf.getPage(1);
    const [, , width, height] = page.view as number[];

    expect(pdf.numPages).toBe(1);
    // A4 in PostScript points, which is what §20.2 asks be verified on paper.
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});

describe('the detector fires — the same check over the full invoice', () => {
  /**
   * The negative case, run on every CI pass.
   *
   * The full style is rendered from the same fixture through the same pipeline
   * and *must* trip the detector. Without this, a broken extractor or a change
   * that stopped producing a text layer would make the confidential assertion
   * above pass for the wrong reason.
   */
  it('finds the amounts in the full style', async () => {
    const text = await textLayerOf(
      <InvoiceFullDocument data={FULL} markSrc={MARK} />,
    );

    const leaks = moneyLeaks(text);

    expect(leaks).toContain('SAR');
    expect(leaks).toContain('11,000'); // total value
    expect(leaks).toContain('1,750'); // B2B rate per night
    expect(leaks).toContain('Balance due');
    expect(leaks).toContain('IBAN');
    expect(leaks.length).toBeGreaterThan(8);
  });

  it('spells the total out in words, and only there', async () => {
    const full = await textLayerOf(
      <InvoiceFullDocument data={FULL} markSrc={MARK} />,
    );
    const confidential = await textLayerOf(
      <InvoiceConfidentialDocument data={toConfidential(FULL)} markSrc={MARK} />,
    );

    expect(full).toContain('Eleven Thousand Saudi Riyals Only');
    expect(confidential).not.toContain('Saudi Riyals Only');
  });
});

describe('the sanitiser', () => {
  it('produces an object with no money in it at all', () => {
    const confidential = toConfidential(FULL);
    const serialised = JSON.stringify(confidential);

    for (const value of Object.values(AMOUNTS)) {
      // Digit boundaries, so a figure only counts when it stands alone — a
      // Unix timestamp ending in 6800 is not a leaked SAR 800.
      expect(serialised).not.toMatch(
        new RegExp('(?<![0-9])' + value + '(?![0-9])'),
      );
    }
    expect(serialised).not.toContain(IBAN);

    // Not merely absent from the JSON — absent from the object.
    expect(Object.keys(confidential)).not.toContain('totalValue');
    expect(Object.keys(confidential)).not.toContain('amountPaid');
    expect(Object.keys(confidential)).not.toContain('paymentStatus');
    expect(Object.keys(confidential)).not.toContain('dueDate');
    expect(Object.keys(confidential.rooms[0])).not.toContain('pricePerNight');
    expect(Object.keys(confidential.rooms[0])).not.toContain('subtotal');
    expect(Object.keys(confidential.services[0])).not.toContain('unitPrice');
    expect(Object.keys(confidential.company)).not.toContain('bankIban');
  });

  it('keeps the counts, which are not money', () => {
    const confidential = toConfidential(FULL);

    expect(confidential.rooms[0].numberOfRooms).toBe(2);
    expect(confidential.rooms[0].numberOfGuests).toBe(4);
    expect(confidential.rooms[0].nights).toBe(3);
    expect(confidential.services[0].quantity).toBe(2);
  });
});

describe('the filename carries the style and no amount (§10)', () => {
  it('names both styles', () => {
    expect(invoiceFileName('AHR-2026-00041', 'full')).toBe(
      'AHR-2026-00041.pdf',
    );
    expect(invoiceFileName('AHR-2026-00041', 'confidential')).toBe(
      'AHR-2026-00041-confidential.pdf',
    );
  });
});

describe('amount in words (§10)', () => {
  it('converts the spec example', () => {
    expect(amountInWords(3450)).toBe(
      'Three Thousand Four Hundred Fifty Saudi Riyals Only',
    );
  });

  it('handles zero, one, and the awkward ranges', () => {
    expect(amountInWords(0)).toBe('Zero Saudi Riyals Only');
    expect(amountInWords(1)).toBe('One Saudi Riyal Only');
    expect(amountInWords(15)).toBe('Fifteen Saudi Riyals Only');
    expect(amountInWords(70)).toBe('Seventy Saudi Riyals Only');
    expect(amountInWords(101)).toBe('One Hundred One Saudi Riyals Only');
    expect(amountInWords(1000)).toBe('One Thousand Saudi Riyals Only');
    expect(amountInWords(1_000_000)).toBe('One Million Saudi Riyals Only');
    expect(amountInWords(-400)).toBe('Minus Four Hundred Saudi Riyals Only');
  });
});
